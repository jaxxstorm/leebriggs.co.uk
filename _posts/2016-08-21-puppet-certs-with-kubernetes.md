---
layout: post
title: Using Puppet's certificates with Kubernetes
category: puppet, kubernetes
---

We're finally beginning to build out our production [Kubernetes](http://kubernetes.io/) infrastructure at work, after some extensive testing in dev. Kubernetes relies heavily on TLS for securing communications between all of the components (quite understandably) and while you can disable TLS on many components, obviously once you get to production, you don't really want to be doing that.

Most of the documentation shows you how to generate a self signed certficate using a CA certificate you create especially for kubernetes. Even [Kelsey Hightower's](https://twitter.com/kelseyhightower) excellent "[Kubernetes the Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/README.md)" post shows you how to [generate the TLS components using a self signed CA](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/02-certificate-authority.md). One of the nicest things about using Puppet is that you already _have_ a CA set up and best of all, there's some really nice APIs inside the puppet master/server meaning provisioning new certs for hosts is relatively straightforward. I really wanted to take advantage of this with our kubernetes setup, so I made sure etcd was using Puppet's certs:

{% highlight bash %}
#[security]
ETCD_CERT_FILE="/var/lib/puppet/ssl/certs/hostname.server.lan.pem"
ETCD_KEY_FILE="/var/lib/puppet/ssl/private_keys/hostname.server.lan.pem"
ETCD_TRUSTED_CA_FILE="/var/lib/puppet/ssl/certs/ca.pem"
ETCD_PEER_CERT_FILE="/var/lib/puppet/ssl/certs/hostname.server.lan.pem"
ETCD_PEER_KEY_FILE="/var/lib/puppet/ssl/private_keys/hostname.server.lan.pem"
ETCD_PEER_CLIENT_CERT_AUTH=true
ETCD_PEER_TRUSTED_CA_FILE="/var/lib/puppet/ssl/certs/ca.pem"
{% endhighlight %}

This works out of the box, because the certs for all 3 etcd hosts have been signed by the same CA.

## Securing Kubernetes with Puppet's Certs.

I figured it would be easy to use these certs for Kubernetes also. I set the following parameters in the API server config:

{% highlight bash %}
--service-account-key-file=/var/lib/puppet/ssl/private_keys/hostname.server.lan.pem --tls-cert-file=/var/lib/puppet/ssl/certs/hostname.server.lan.pem --tls-private-key-file=/var/lib/puppet/ssl/private_keys/hostname.server.lan.pem
{% endhighlight %}

but there were a multitude of problems, the main one being that when a pod starts up, it connects to the API using the kubernetes service cluster IP. You can see this in the log messages when starting a pod:

{% highlight bash %}
# kubectl logs kube-dns-v15-017ri --namespace=kube-system kubedns
I0821 08:48:12.808230       1 server.go:91] Using https://10.254.0.1:443 for kubernetes master
I0821 08:48:12.808304       1 server.go:92] Using kubernetes API <nil>
I0821 08:48:12.809448       1 server.go:132] Starting SkyDNS server. Listening on port:10053
{% endhighlight %}

I figured it would be easy enough to fix, I'll just add a SAN for the puppet cert using the [dns_alt_names](https://docs.puppet.com/puppet/latest/reference/configuration.html#dnsaltnames) configuration option. Unfortunately, this didn't work, and I got the following error message:

{% highlight bash %}
E1125 17:33:16.308389 1 errors.go:62] Status: x509: cannot validate certificate because it doesn't contain any IP SANs
{% endhighlight %}

Puppet doesn't have an option to set IP SANS in the SSL certificate, so I had to generate the cert manually and sign it by the Puppet CA. Thankfully, this is fairly straightforward (albeit manual)

## Generating Certs Manually

First, create a Kubernetes config file for OpenSSL on your puppetmaster. I created a directory /var/lib/puppet/ssl/manual_ca to do all this.

{% highlight bash %}
[ ca ]

default_ca      = CA_default

[ CA_default ]

dir            = /var/lib/puppet/ssl/manual_ca
certs          = $dir/certs
crl_dir        = $dir/crl
database       = $dir/index.txt
new_certs_dir  = $dir/newcerts
certificate    = /var/lib/puppet/ssl/ca/ca_crt.pem
serial         = $dir/serial
crl            = /var/lib/puppet/ssl/ca/ca_crl.pem
private_key    = /var/lib/puppet/ssl/ca/ca_key.pem
RANDFILE       = $dir/ca/.rand
default_md     = sha256
policy         = policy_any
unique_subject = no

[ policy_any ]
countryName            = supplied
stateOrProvinceName    = optional
organizationName       = optional
organizationalUnitName = optional
commonName             = supplied
emailAddress           = optional

[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name
string_mask             = utf8only

[ req_distinguished_name ]
countryName             = Country
stateOrProvinceName     = State
localityName            = Locality
organizationName        = Org
organizationalUnitName  = Me
commonName              = hostname

[ v3_req ]
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
DNS.3 = kubernetes.default.svc
DNS.4 = kubernetes.default.svc.cluster.local
DNS.5 = kubernetes.service.discover
DNS.6 = hostname
IP.1 = 10.254.0.1
IP.2 = 192.168.4.10 # external IP
{% endhighlight %}

Note the two IPs here. The first is the cluster IP from the kubernetes service, you can retrieve it like so:

{% highlight bash %}
# kubectl get svc
NAME           CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
kubernetes     10.254.0.1       <none>        443/TCP    21d
{% endhighlight %}

I also added the actual IP of the kubernetes host for some future proofing. The DNS names have been generated from the Kube DNS config, so also make sure you match that to your kube-dns name.

Next, we need to generate a CSR and a key:

{% highlight bash %}
openssl req -newkey rsa:2048 -nodes -keyout private_keys/kube-api.key -out certificate_requests/kube-api.csr -config kubernetes.cnf
{% endhighlight %}

Verify that your CSR has the IP SANS in it:

{% highlight bash %}
openssl req -text -noout -verify -in certificate_requests/kube-api.csr | grep "X509v3 Subject" -A 1
{% endhighlight %}

Now, we need to sign the cert with the Puppet CA:

{% highlight bash %}
openssl x509 -req -in certificate_requests/kube-api.csr -CA /var/lib/puppet/ssl/ca/ca_crt.pem -CAkey /var/lib/puppet/ssl/ca/ca_key.pem -CAcreateserial -out certs/kube-api.pem -days 3000 -extensions v3_req -extfile kubernetes.cnf
{% endhighlight %}

This will create a cert in certs/kube-api.pem. Now verify it to ensure it looks okay:

{% highlight bash %}
openssl x509 -in certs/kube-api.pem -text -noout
{% endhighlight %}

We now have the a cert we can use for our kube-apiserver, so we just need to configure kubernetes to use it.

## Configuring Kubernetes to use the certs.

Assuming you've copied the certs to your kubernetes master, we now need to configure k8s to use it. First, make sure you have the following config set in the apiserver:
{% highlight bash %}
--service-account-key-file=/etc/kubernetes/kube-api.key --tls-cert-file=/etc/kubernetes/kube-api.pem --tls-private-key-file=/etc/kubernetes/kube-api.key
{% endhighlight %}

And then configure the controller manager like so:

{% highlight bash %}
--root-ca-file=/var/lib/puppet/ssl/certs/ca.pem --service-account-private-key-file=/etc/kubernetes/kube-api.key
{% endhighlight %}

Restart all the k8s components, and you're almost set.

## Regenerate service account secrets

The final thing you'll need to do is delete the service account secrets kubernetes generates on launch. The reason for this is because it use the service-account-private-key-file to generate them, and if you don't do this you'll get all manner of permission denied errors when launching pods. It's easy to do this:

{% highlight bash %}
kubectl delete sa default
kubectl delete sa default --namespace=kube-system
{% endhighlight %}

_NOTE_ if you're already running pods in your kubernetes system, this may affect them and you may want to be careful doing this. YMMV.

From here, you're using Puppet's SSL Certs for kubernetes.









