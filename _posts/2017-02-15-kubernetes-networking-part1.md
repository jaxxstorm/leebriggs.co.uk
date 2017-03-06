---
title: Kubernetes Networking - Part 1
layout: post
category: blog
tags:
- kubernetes
- flannel
- calico
---

I have some problems with Kubernetes.

It's a fantastic tool that is revolutionizing the way we do things at $work. However, because of its code complexity, and the vast number of features, plugins, addons and options, the documentation isn't getting the job done.

The other issue is that too many of the "Getting Started" tutorials gloss over the parts that you *actually* need to know. Let's take a look at the [kubeadm](https://kubernetes.io/docs/getting-started-guides/kubeadm/) page, for example. In the networking section, it says this:

> You can install a pod network add-on with the following command:  kubectl apply -f <add-on.yaml>

Now, the ease of this is fantastic. You can initialize your network super easily, and if you're playing around with minikube or some other small setup, this really takes the pain out of getting started.

However, take a look at the full [networking documentation](https://kubernetes.io/docs/admin/networking/) page. If things go wrong, are you going to have any idea what's going on here? Do you feel comfortable running this in production?

I certainly didn't, so for the past week or so, I've been learning how all this works. I'm going to detail all this in two parts. First, I'm going to explain in sysadmin (ie I try to avoid network gear at all costs) terms how kubernetes approaches networking. Most of the information here is in the earlier linked networking doc, but I'm going to put it in my own words.

The next post will be specifically about my chosen pod network provider, [Calico](https://projectcalico.org) and how it interacts with your OS and containers.

**Disclaimer:** I'm not an expert on networking by any stretch of the imagination. If any of this is wrong, please [send a pull request](https://github.com/jaxxstorm/jaxxstorm.github.io)

# Basics

There's a lot of words on the earlier networking page. I'm going to sum it up a bit differently. *In order for Kubernetes to work, every pod needs to have its own IP address like a VM*

This is in direct conflict with the default setup of standalone Docker. By default Docker gives itself a private IP address on the host. It creates an  bridge interface, `docker0` and then grabs an IP, usually something like `172.17.0.1`

All the containers then get ` veth` interface so they can talk to each other. The problem here is that they can only talk to containers on the same host. In order to talk to containers on *other* hosts, they have to start port mapping on the host. Anyone who's had to deal with this at scale knows its an exercise in futility.

So, back to Kubernetes. Every pod gets an IP right? How does it do that?

Well, the pod network mentioned above (you know, that yaml file you downloaded and blindly installed) is usually the thing that controls that. The way it does that varies slightly depending on your chosen network provider (whether it be flannel, weave, calico etc) but the basics remain essentially the same.

# An IP for every container

When the pod network starts up, you usually have to provide a relatively large subnet for configuration. [The CoreOS flannel docs](https://coreos.com/flannel/docs/latest/flannel-config.html), for example suggest using the subnet ` 10.1.0.0/16`. You'll see why this is so large in a moment.

The subnet is usually predetermined and needs to be stored somewhere, which increasingly seems to be etcd. You usually have to set this before launching the pod network, and it's often stored in the kubernetes manifest. If you look at the [kube-flannel](https://github.com/coreos/flannel/blob/master/Documentation/kube-flannel.yml) manifest, you'll see this:

{% highlight yaml %}
kind: ConfigMap
apiVersion: v1
metadata:
  name: kube-flannel-cfg
  labels:
    tier: node
    app: flannel
data:
  cni-conf.json: |
    {
      "name": "cbr0",
      "type": "flannel",
      "delegate": {
        "isDefaultGateway": true
      }
    }
  net-conf.json: |
    {
      "Network": "10.244.0.0/16",
      "Backend": {
        "Type": "vxlan"
      }
    }
{% endhighlight %}

This is simple, it's setting a [CNI](https://github.com/containernetworking/cni) config, which will then be shipped off to etcd to be stored for safekeeping.

When a container comes online, it looks at the preprovided subnet, and will give itself an IP address from the subnet provided.

# Connectivity

Now, just because there's a subnet assigned, doesn't mean there's *connectivity*. And if you remember previously, pods need to have connectivity, even across different hosts.

This is important, and is something you should ensure works before you start deploying this to Kubernetes. From kubernetes node, *you should be able to get icmp traffic any pod on your network* and you should *also be able to ping any pod ip from another pod*. It depends on your pod network how this work. With [flannel](https://github.com/coreos/flannel) for example, you get an interface added on each host (usually `flannel0`) and the connectivity is provided across a layer2 overlay network using vxlan. This is relatively simple, but there are some performance penalties. Calico uses a more elegant but more complicated solution which I'll cover in much more detail in the next post.

In the meantime, let's look at what a working config looks like in action.

## Testing Connectivity

I've deployed the guestbook here, and you can see the pod ips like so:

{% highlight bash %}
kubectl get po -o wide
NAME                           READY     STATUS    RESTARTS   AGE       IP                NODE
frontend-88237173-jdfgg        1/1       Running   0          2h        192.168.175.197   host1
frontend-88237173-mzmjf        1/1       Running   0          4h        192.168.163.65    host2
frontend-88237173-z3ltv        1/1       Running   0          5h        192.168.173.195   host1
redis-master-343230949-2qrp7   1/1       Running   0          5h        192.168.90.131    host3
redis-slave-132015689-890b2    1/1       Running   0          5h        192.168.90.132    host1
redis-slave-132015689-k0rk5    1/1       Running   0          5h        192.168.175.196   host3
{% endhighlight %}

Now, in a working cluster, I should be able to get to any one of these IPs from my master:

{% highlight bash %}
# ping -c 1 192.168.175.196
PING 192.168.175.196 (192.168.175.196) 56(84) bytes of data.
64 bytes from 192.168.175.196: icmp_seq=1 ttl=63 time=0.433 ms

--- 192.168.175.196 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.433/0.433/0.433/0.000 ms
{% endhighlight %}

*if this doesn't work from any node in your cluster, something is probably wrong*

Similarly, you should be able to enter another pod and ping across pods:

{% highlight bash %}
# ping -c 1 192.168.90.131
PING 192.168.90.131 (192.168.90.131): 48 data bytes
56 bytes from 192.168.90.131: icmp_seq=0 ttl=62 time=0.358 ms
--- 192.168.90.131 ping statistics ---
1 packets transmitted, 1 packets received, 0% packet loss
round-trip min/avg/max/stddev = 0.358/0.358/0.358/0.000 ms
{% endhighlight %}

This fulfills the fundamental requirements of Kubernetes, and you know things are working. If this isn't working, you need to get troubleshooting as to why.

Now, with flannel, this is all abstracted away from you, and it's difficult to decipher. Some troubleshooting tips I'd recommend:

* Make sure `flannel0` actually exists, and check the flannel logs
* Break out `tcpdump` with `tcpdump -vv icmp` and check the icmp request are arriving and leaving the nodes correctly.

With Calico, this is much easier to debug (in my opinion) and I'll detail some troubleshooting exercises in the next post.

## A quick note about services

One thing that I got confused about when I started with kubernetes is, why can't I ping service IPs?

{% highlight bash %}
# ping -c 1 kubernetes.default
PING kubernetes.default.svc.cluster.local (10.96.0.1): 48 data bytes
--- kubernetes.default.svc.cluster.local ping statistics ---
1 packets transmitted, 0 packets received, 100% packet loss
{% endhighlight %}

The reason for this is actually quite simple - they don't *technically* exist!

### kube-proxy

All the services in a cluster are handled by [kube-proxy](https://kubernetes.io/docs/admin/kube-proxy/). kube-proxy runs on every node in the cluster, and what it does it write `iptables` rules for each service. You can see this when you run `iptables-save`:

{% highlight bash %}
-A KUBE-SERVICES -d 10.107.179.200/32 -p tcp -m comment --comment "default/redis-master: cluster IP" -m tcp --dport 6379 -j KUBE-SVC-7GF4BJM3Z6CMNVML
-A KUBE-SERVICES ! -s 192.168.0.0/16 -d 10.98.90.196/32 -p tcp -m comment --comment "default/redis-slave: cluster IP" -m tcp --dport 6379 -j KUBE-MARK-MASQ
-A KUBE-SERVICES -d 10.98.90.196/32 -p tcp -m comment --comment "default/redis-slave: cluster IP" -m tcp --dport 6379 -j KUBE-SVC-AGR3D4D4FQNH4O33
-A KUBE-SERVICES ! -s 192.168.0.0/16 -d 10.99.237.90/32 -p tcp -m comment --comment "default/frontend: cluster IP" -m tcp --dport 80 -j KUBE-MARK-MASQ
-A KUBE-SERVICES -d 10.99.237.90/32 -p tcp -m comment --comment "default/frontend: cluster IP" -m tcp --dport 80 -j KUBE-SVC-GYQQTB6TY565JPRW
-A KUBE-SERVICES ! -s 192.168.0.0/16 -d 10.96.0.1/32 -p tcp -m comment --comment "default/kubernetes:https cluster IP" -m tcp --dport 443 -j KUBE-MARK-MASQ
-A KUBE-SERVICES -d 10.96.0.1/32 -p tcp -m comment --comment "default/kubernetes:https cluster IP" -m tcp --dport 443 -j KUBE-SVC-NPX46M4PTMTKRN6Y
-A KUBE-SERVICES ! -s 192.168.0.0/16 -d 10.96.0.10/32 -p udp -m comment --comment "kube-system/kube-dns:dns cluster IP" -m udp --dport 53 -j KUBE-MARK-MASQ
-A KUBE-SERVICES -d 10.96.0.10/32 -p udp -m comment --comment "kube-system/kube-dns:dns cluster IP" -m udp --dport 53 -j KUBE-SVC-TCOU7JCQXEZGVUNU
{% endhighlight %}

This is just a taste of what you'll see, but essentially, these iptables rules manage the traffic towards the service IPs. They don't actually *have* any rules for ICMP, because it's not needed.

So, if from host you try hit a service on a `TCP` port, you'll see it works!

{% highlight bash %}
# curl -k https://10.96.0.1
Unauthorized
{% endhighlight %}

Don't be fooled on the Unauthorized message here, it's just the kubernetes API rejecting unauthorized requests. Iptables handily translated the request off towards the node the pod is running on, and made it hit the IP for you. Here's the `iptables` rule:

{% highlight bash %}
-A KUBE-SEP-EHCIXHWU3R7SVNN2 -s 172.29.132.126/32 -m comment --comment "default/kubernetes:https" -j KUBE-MARK-MASQ
-A KUBE-SEP-EHCIXHWU3R7SVNN2 -p tcp -m comment --comment "default/kubernetes:https" -m recent --set --name KUBE-SEP-EHCIXHWU3R7SVNN2 --mask 255.255.255.255 --rsource -m tcp -j DNAT --to-destination 172.29.132.126:6443
{% endhighlight %}

Simple!

# Wrap up

This should wrap up the basics of how kubernetes networking works, without going into the specifics of exactly what's happening. In the next post, I'll specifically cover [Calico](https://projectcalico.org) and how it operates alongside kubernetes using the magic of routing to help your packets reach their destination.
