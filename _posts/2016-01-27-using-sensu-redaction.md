---
layout: post
title: Using sensu redaction
category: sensu 
---

Sensu has a lot of cool features, but some of them are rarely used because either the documentation isn't massively clear, or people deem it a "bit hard". One of these cool features is redaction of passwords. You may have seen many a sensu check in the uchiwa dashboard with the password hanging out on the command line call used to run the sensu plugin. This isn't much fun, especially when you consider that many remote services require some kind of API key or password to check their health.

Well, fortunately, this is pretty easy to rectify with a few tweaks.

It's worth mentioning at this point that I use sensu to deploy my sensu clients and checks, so this will assume you're doing the same. I'll try include pure JSON examples where possible so that those of you that use other config management tools can follow along.

### Let's redact some shit

A fundamental thing to understand with redaction is that the redaction key you want to use is actually set inside the client config, not inside the check. You have to define on the client config:

  - What things you want to redact
  - What the password for $service will be

### Redacting fields
 
Determining what to redact is fairly easy; just include a "redact" key in the client's json.

If you use Puppet, you can do this really easily using the sensu-puppet module using sensu::redact (note, at time of writing this hasn't been merged, but hoping it will soon!)

{% highlight puppet %}

class { 'sensu':
  redact => [ 'password', 'pass', 'api_key' ]
}

{% endhighlight %}

Or, if like me, you use hiera, setting the following in your common.yaml

{% highlight yaml %}

sensu::redact
  - "password"
  - "pass"
  - "api_key"

{% endhighlight %}

This will result in the following JSON in your client config:

{% highlight javascript %}

{
  "client": {
    "name": "client",
    "address": "192.168.4.21",
    "subscriptions": [
      "base"
    ],
    "safe_mode": false,
    "keepalive": {
      "handler": "opsgenie",
      "thresholds": {
        "warning": 45,
        "critical": 90
      }
    },
    "redact": [
      "password",
      "api_key",
      "pass",
    ],
    "socket": {
      "bind": "127.0.0.1",
      "port": 3030
    }
  }
}

{% endhighlight %}


### Setting a service password

Depending on how you do your configuration management, you may find this easy or hard, but the next step is to set a password inside the client for the service you'll monitor. I make heavy use of the [roles and profiles](http://garylarizza.com/blog/2014/02/17/puppet-workflow-part-2/) pattern with my Puppet config, so this is a simple as setting a password inside a particular client role. Normally I use hiera to do this, and I make use of sensu-puppet's client_custom options to set up these passwords. It looks a little bit like this:

{% highlight puppet %}
class { 'sensu':
  redact => [ 'password', 'pass', 'api_key' ]
  client_custom => {
    github => {
      password => 'correct-horse-battery-staple',
    },
  },
}
{% endhighlight %}

or with hiera:

{% highlight yaml %}
sensu::redact
  - "password"
  - "pass"
  - "api_key"
sensu::client_custom:
  - sensu::client_custom:
  nexus:
    password: "correct-horse-battery-staple'
{% endhighlight %}

The resulting JSON, for those that use different config management systems, looks like this:

{% highlight javascript %}

{
  "client": {
    "name": "client",
    "address": "192.168.4.21",
    "subscriptions": [
      "base"
    ],
    "safe_mode": false,
    "keepalive": {
      "handler": "opsgenie",
      "thresholds": {
        "warning": 45,
        "critical": 90
      }
    },
    "redact": [
      "password",
      "api_key",
      "pass",
    ],
    "socket": {
      "bind": "127.0.0.1",
      "port": 3030
    },
    "github": {
      "password": "correct-horse-battery-staple"
    }
  }
}

{% endhighlight %}

Note I've set up the service name (github) and then made a subkey of "password". Because we set the "password" field to be redacted, we need to use a subkey, so that only the password is redacted.

When you look in your dashboard or in your logfiles, you'll now see something like this:

![Sensu Redaction](http://i.imgur.com/K4noGoN.png)

### Using the password

Now, when I define the sensu check on the clients (with the same role, so it has access to the password, obviously) we use [check command token substituion](https://sensuapp.org/docs/0.16/checks#check-command-token-substitution) to make use of this field. This will essentially grab the correct value from the client config (which you defined earlier) and use that instead of the substitution.

{% highlight puppet %}
sensu::check{ 'check_password_test':
  command      => '/usr/local/bin/check_password_test --password :::github.password::: ',
}
{% endhighlight %}

of course, with JSON, just make sure the command field uses the substitution:

{% highlight javascript %}
{
  "checks": {
    "check_password_test": {
      "standalone": true,
      "command": "/usr/local/bin/check_password_test --password :::github.password:::",
    }
  }
}

{% endhighlight %}

Hopefully this clears up some questions about how exactly sensu redaction is used in the wild, as it's fairly easy to implement and yet not a lot of people seem to do it!
