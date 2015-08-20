---
layout: post
title: "GOTCHA: Syncing PuppetLabs Repos with MRepo"
category: "infrastructure"
tags: mrepo puppetlabs
---
At {place of work}, in order to reduce our outband bandwidth, we do the sensible thing and mirror the CentOS repos locally in order to not, y'know, pull down a couple gig of RPM's every time we do a server build. Obviously, a lot of people do this, and there's various methods of achieveing the same thing. We use a nice python tool called [mrepo](http://dag.wiee.rs/home-made/mrepo/) to do the bulk of the work, with the added nicety that PuppetLabs already wrote a [module](https://github.com/puppetlabs/puppetlabs-mrepo) to do a lot of the heavy lifting.

As well as mirroring the CentOS repos, we also mirror the [PuppetLabs CentOS Repos](https://docs.puppetlabs.com/guides/puppetlabs_package_repositories.html) and I came across an annoying little quirk of MRepo today which was nice to fix.

I did a manual mrepo sync of the repo, and noticed it was defaulting to the IPv6 Address that PuppetLabs uses:

{% highlight bash %}
# mrepo -ugvvvvvvv -r puppetlabs_products
Verbosity set to level 7
< ...snip.... >
CentOS-EL6-x86_64: Updating CentOS EL6 x86_64
CentOS-EL6-x86_64: Setting lock /var/cache/mrepo/CentOS-EL6-x86_64/update-puppetlabs_products.lock
CentOS-EL6-x86_64: Mirror packages from http://yum.puppetlabs.com/el/6/products/x86_64/ to /var/mrepo/CentOS-EL6-x86_64/puppetlabs_products
Execute: exec /usr/bin/lftp  -d -c '; mirror -c -P -v -v -v -v -v -v -e -I *.rpm -X "/headers/" -X "/repodata/" -X "*.src.rpm" -X "/SRPMS/" -X "*-debuginfo-*.rpm" -X "/debug/" http://yum.puppetlabs.com/el/6/products/x86_64/ /var/mrepo/CentOS-EL6-x86_64/puppetlabs_products'
---- Resolving host address...
---- 2 addresses found: 2600:3c00::f03c:91ff:fe69:6bf0, 198.58.114.168
---- Connecting to yum.puppetlabs.com (2600:3c00::f03c:91ff:fe69:6bf0) port 80
{% endhighlight %}

Obviously, this wasn't much good to me, and it can already see the IPv4 address, so why isn't it using it?

The answer, it turns out, is due to mrepo's sync tool [lftp](http://lftp.yar.ru/). In order to fix this, you need to configure lftp to use IPv4 first. To do this, it's as simple as adding the following to the lftp config like so:

{% highlight bash %}
echo 'set dns:order "inet inet6"' >> /etc/lftp.conf
{% endhighlight %}
