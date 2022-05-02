---
layout: post
title: Sensu Aggregates
category: sensu
---

Sensu has really evolved into a first class monitoring tool, and the main reason for this is in part due to its flexibility and being able to solve monitoring problems in a way that suits you. Up until this point at $employer, we've mainly made use of sensu checks that run locally on the client they're registered to (referred to from here as "standalone mode") and this accounts for probably 85% of the monitoring checks that we run. It's the usually mix of disk space and "is this service running" and of course, the right place to run these checks is directly on the client.

As previously mentioned, we use Puppet to distribute these checks, and the [puppet-sensu module](https://github.com/sensu/sensu-puppet.git) makes this easy, you simply define a check using the sensu::check defined type:


```puppet
  ::sensu::check { 'check_something':
    ensure     => 'present',
    command    => '/my/command.rb',
    standalone => true,
  }
```

A big driver for making this easy has been yelp's [monitoring_check module](https://github.com/Yelp/puppet-monitoring_check) puppet module, which is a defined type wrapper around the ::sensu::check type which sets up some sane defaults for you and incorporates some things like sending alerts to different teams, assuming you make use of their [sensu handlers](https://github.com/Yelp/sensu_handlers) as well.

Yelp mainly uses standalone checks, but to solve the problem of monitoring remote more complex services like clusters and remote services, they've taken an interesting approach. They've written some custom monitoring checks with actually dip into the redis datastore for sensu to collect aggregates for each check and then return the result, and they've also written a monitoring check which will check server side components and manually lock between sensu servers. You can see their examples in their [fleet_check](https://github.com/Yelp/puppet-monitoring_check/blob/master/files/fleet_check.rb), [check-cluster](https://github.com/Yelp/puppet-monitoring_check/blob/master/files/check-cluster.rb) and the [check_server_side](https://github.com/Yelp/puppet-monitoring_check/blob/master/files/check_server_side.rb) checks.

I did something similar to Yelp with my defined types for standalone checks, but making use of their server side, aggregation and fleet checks wasn't really going to cut it for me because their sensu setup makes a series of assumptions about how to set up your sensu infrastructure, and my infrastructure isn't like theirs in many ways. I went a different route to solve the aggregate and server side checks which uses sensu's built in capabilities to execute the checks, and I've never really seen a write up on how to do these things, so I'm going to write them in a couple of blog posts. First, we'll start off with an aggregate check.

## Defining a server side check

The first thing you have to do is simple, set up a check on the server side of sensu. The way this works is that instead of the check definition residing on the client, it resides on the server, and the sensu client _subscribes_ to the checks. Let's assume here that we have a fleet of web servers that we want to check - first, we'd need to assign a subscription to the sensu client:

```puppet
  node 'sensu-client.example.com' {
    class { 'sensu':
      subscriptions => [ 'webservers', 'base' ],
    }
  }
```

This translate to JSON for the client conf like so:

```json
{
  "client": {
    "name": "webserver",
    "address": "10.0.0.1",
    "subscriptions": [
      "base",
      "webservers"
    ],
    "bind": "127.0.0.1",
    "port": "3030",
    "safe_mode": false,
  }
}
```

One we've set the subscription on the client, we can create a check on the server that executes on the client using the subscription. On your server, create a check like so:

```puppet
node 'sensu-server.example.com' {
  ::sensu::check { 'check-webserver':
    ensure      => 'present',
    command     => '/etc/sensu/plugins/check-webserver.rb',
    standalone  => false,
    subscribers => [ 'webservers' ],
  }
}
```

Now, when you restart the sensu client and server, the check definition will appear on the sensu server as a normal check but will execute on the client.

On its own, this doesn't give you must more benefit than just a standalone check residing on a client, but it really starts to become useful when you want to check multiple different hosts for the same condition.

Say for example we have 30 web servers, and one being down isn't necessarily a problem because we have a great load balancer that will kill the connections. However, if 50% of the web servers are down you'll have a problem, because your ability to deal with traffic is compromised. If you've defined the check server side, you can make use of sensu's [aggregate feature](https://sensuapp.org/docs/latest/api-aggregates) to help you here.

## Defining an aggregate

Turning a check into an aggregate is easy, assuming you've defined the check on the server side. Unfortunately, aggregates _only_ work on the server side. The reason for this is because when you define a server side check, a sensu server will send out a check request to all clients at the same time, with a timestamp defined when the request was sent. When the server gets all the results back, they all have the same timestamp and so you can aggregate them. With a client side check, the timestamps will all be completely different so aggregating isn't really an option.

To define the aggregate, just set up the aggregate parameter - with the puppet module:

```puppet
node 'sensu-server.example.com' {
  ::sensu::check { 'check-webserver':
    ensure      => 'present',
    command     => '/etc/sensu/plugins/check-webserver.rb',
    standalone  => false,
    subscribers => [ 'webservers' ],
    aggregate   => true,
    handle      => false,
  }
}
```

It's worth noting here that I've also set the parameter handle => false, the reason for this is because I don't care if a single web server fails, I just want to know about the health of the web servers overall. The JSON looks like so:

```json
{
  "checks": {
    "check-webserver": {
      "command": "/etc/sensu/plugins/check-webserver.rb",
      "subscribers": [
        "webservers"
      ],
      "standalone": false,
      "aggregate": true,
      "handle": false
    }
  }
}
```

Once this starts to run, you'll be able to see the aggregate by querying the sensu API:

```bash
curl -s -u admin -p http://sensu-server.example.com:4567/aggregates | jq .
Enter host password for user 'admin':
[
  {
    "check": "check-webserver",
    "issued": [
      1454081158,
      1454080558,
      1454079958,
      1454079358,
      1454078758,
      1454078158,
      1454077557,
      1454076957,
      1454076357,
      1454075757,
      1454075157,
      1454074557,
      1454073957,
      1454073357,
      1454072757,
      1454072157,
      1454071557,
      1454070957,
      1454070357,
      1454069757
    ]
  },
```

and if you look at a single aggregate, you'll start to see how useful they are!

```bash
curl -s -u admin -p http://sensu-server.example.com:4567/aggregates/check-webserver/1454081758 | jq .
Enter host password for user 'admin':
{
  "ok": 30,
  "warning": 1,
  "critical": 1,
  "unknown": 0,
  "total": 32
}
```

Now we're in a position to know how many of our webservers are responding easily. We have all the check results aggregated, and we can query the API easily to see the status. The final step is to alert on this aggregate.

## Alerting on an aggregate check

You can write any number of custom checks here to make this work, but I chose to make use of the available [check-aggregate.rb](https://github.com/sensu-plugins/sensu-plugins-sensu/blob/master/bin/check-aggregate.rb) in the community plugins repo. You invoke it like so:

```basg
/etc/sensu/plugins/check-aggregate.rb -a http://sensu-server.example.com:4567 -c check-webserver -u admin -p <password> -C 10 -M "10% of your webservers are down!"
```

This is hopefully pretty self explanatory, but basically, you need to pass the sensu API details, as well as a threshold under which your aggregate will drop and a message the check will output if the check fails. 

To have this run, you can define it as a standalone check:

```puppet
node 'sensu-server.example.com' {
  ::sensu::check { 'check-webserver-cluster':
    ensure      => 'present',
    command     => '/etc/sensu/plugins/check-aggregate.rb -a http://sensu-server.example.com:4567 -c check-webserver -u admin -p <password> -C 10 -M "10% of your webservers are down!"',
    standalone  => true,
    source      => "production_webservers",
  }
}
```

Notice I make use of the "source" parameter so that sensu will create a [JIT client](https://sensuapp.org/docs/latest/clients#jit-clients) rather than have it create an event for our monitoring server.

This will work, and you'll have monitoring of your aggregate working - yay!

One thing to note though, is that this check will be running on your monitoring server all the time, and this might not be desirable. In the next post I'll talk about another use of sensu-server side checks and how we can use them to schedule the check to run on only one of the hosts in a subscription, to make a check highly available across your fleet!
