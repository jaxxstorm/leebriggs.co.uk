---
layout: post
title: A Better Puppetmaster Healthcheck
category: puppet
---

In my [last post]({% post_url 2016-02-08-infrastructure-service-discovery %}) I wrote about service discover with my Puppetmasters using [consul](https://consul.io) 

As part of this deployment, I deployed a healthcheck using Consul's [TCP Checks](https://www.consul.io/docs/agent/checks.html) to check the puppetmasters was responding in its default port (8140). In Puppet, it looked like this:

{% highlight puppet %}
::consul::check { 'puppetmaster_tcp':
    interval   => '60',
    tcp        => 'localhost:8140',
    notes      => 'Puppetmasters listen on port 8140',
    service_id => 'puppetmaster',
}
{% endhighlight %}

The problem with this approach is that it's a dumb check - the puppetmaster runs in a webserver and while the port might be open, what happens if the application is returning a 500 internal server error, for example?

In order to rectify this, I decided to make use of a Puppet [HTTP API](https://docs.puppetlabs.com/guides/rest_api.html) endpoint to query the status.

I must admit, I didn't even _know_ that Puppet had a HTTP API until recently. Looking through the docs brought up some gems, but the problem is that by default it's pretty locked down - and rightly so. It's a powerful API and a compromised Puppetmaster via API is a dangerous prospect.

Managing this is done via [auth.conf](https://docs.puppetlabs.com/puppet/latest/reference/config_file_auth.html) and you use the [allow](https://docs.puppetlabs.com/puppet/latest/reference/config_file_auth.html#allow) directive.

While digging through the API docs, I found a nice [status](http://docs.puppetlabs.com/puppet/latest/reference/http_api/http_status.html) endpoint. However, while querying it, I got a 404 access denied:

{% highlight bash %}
curl --cert /var/lib/puppet/ssl/certs/puppetmaster.example.com --key /var/lib/puppet/ssl/private_keys/puppetmaster.example.com.pem --cacert /var/lib/puppet/ssl/ca/ca_crt.pem -H 'Accept: pson' https://puppetmaster.example.com:8140/production/status/test?environment=production
Forbidden request: puppetmaster.example.com(192.168.4.21) access to /status/test [find] authenticated  at :119
{% endhighlight %}

This seems easily fixable and extremely useful. In order to make this work, I made a quick change to the auth.conf:

{% highlight bash %}
# allow access to the status API call to test if the master is alive
path /status
auth any
method find
allow_ip 192.168.4.21,127.0.0.1
{% endhighlight %}

This needs go to _above_ the default policy in auth.conf, which looks like this:

{% highlight bash %}
# deny everything else; this ACL is not strictly necessary, but
# illustrates the default policy.
path /
auth any
{% endhighlight %}

Now, when I try the curl command again, it works!

{% highlight bash %}
curl --cert /var/lib/puppet/ssl/certs/puppetmaster.example.com --key /var/lib/puppet/ssl/private_keys/puppetmaster.example.com.pem --cacert /var/lib/puppet/ssl/ca/ca_crt.pem -H 'Accept: pson' https://puppetmaster.example.com:8140/production/status/test?environment=production
{"is_alive":true,"version":"3.8.4"}
{% endhighlight %}

Sweet, now we can make a proper healthcheck!

Because we set the auth.conf entry to be auth any, it's straightforward to make a query to the API endpoint. I used the nagios [check_http](https://www.monitoring-plugins.org/doc/man/check_http.html) check to get this looking nice. The command looks a bit like this:

{% highlight bash %}
/usr/lib64/nagios/plugins/check_http -H localhost -p 8140 -u /production/status/test?environment=production -S -k 'Accept: pson' -s '"is_alive":true'
{% endhighlight %}

Simply, we're querying localhost on port 8140 and then providing an environment (production is my default environment). The Puppetmaster wants pson, so we send a PSON header, and then we check for the string is_alive. The output looks like this:

{% highlight bash %}
HTTP OK: HTTP/1.1 200 OK - 312 bytes in 0.127 second response time |time=0.127082s;;;0.000000 size=312B;;;0
{% endhighlight %}

This is much, much better than our port check. If we get something other than a 200 OK HTTP code, we're in trouble.

### Consul

The original point of this post was replacing the consul check of TCP. In Puppet code, that looks like this:

{% highlight puppet %}
  ::consul::check { 'puppetmaster_healthcheck':
    interval   => '60',
    script     => "/usr/lib64/nagios/plugins/check_http -H ${::fqdn} -p 8140 -u /production/status/test?environment=production -S -k 'Accept: pson' -s '\"is_alive\":true'",
    notes      => 'Checks the puppetmaster\'s status API to determine if the service is healthy',
    service_id => 'puppetmaster',
  }
{% endhighlight %}

We'll now get an accurate an reliable healthcheck from our consul check!

