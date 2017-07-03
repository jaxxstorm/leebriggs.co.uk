---
title: 'Kubernetes Networking: Part 2 - Calico'
layout: post
category: blog
tags:
- kubernetes
- calico
---

In the previous post, I went over some basics of how Kubernetes networking works from a fundamental standpoint. The requirements are simple: every pod needs to have connectivity to every other pod. The only differentiation between the many options were how that was achieved.

In this post, I'm going to cover some of the fundamentals of how  [Calico](https://www.projectcalico.org/) works. As I mentioned in the previous post, I really don't like the idea that with these kubernetes deployments, you simply grab a yaml file and deploy it, sometimes with little to no explanation of what's actually happening. Hopefully, this post will servce to better understand what's going on.

As before, I'm not by any means a networking expert, so if you spot any mistakes, please [send a pull request!](https://github.com/jaxxstorm/jaxxstorm.github.io/pulls)

# What is Calico?
Calico is a container networking solution created by MetaSwitch. While solutions like Flannel operate over layer 2, Calico makes use of layer 3 to route packets to pods. The way it does this is relatively simple in practice.
Calico can also provide network policy for Kubernetes. We'll ignore this for the time being, and focus purely on how it provides container networking.

# Components
Your average calico setup has 4 components:

## Etcd

Etcd is the backend data store for all the information Calico needs. If you've deployed Kubernetes already, you already _have_ an etcd deployment, but it's usually suggested to deploy a separate etcd for production systems, or at the very least deploy it outside of your kubernetes cluster.

You can examine the information that calico provides by using etcdctl. The default location for the calico keys is `/calico`

{% highlight bash %}
$ etcdctl ls /calico
/calico/ipam
/calico/v1
/calico/bgp
{% endhighlight %}

## BIRD
The next key component in the calico stack is [BIRD](http://bird.network.cz/). BIRD is a BGP routing daemon which runs on every host. Calico makes uses of BGP to propagate routes between hosts. BGP (if you're not aware) is widely used to propagate routes over the internet. It's suggested you make yourself familiar with some of the concepts if you're using Calico.

Bird runs on every host in the Kubernetes cluster, usually as a [DaemonSet](https://kubernetes.io/docs/admin/daemons/). It's included in the calico/node container.

## Confd
[Confd](https://github.com/kelseyhightower/confd) is a simple configuration management tool. It reads values from etcd and writes them to files on disk. If you take a look inside the calico/node container (where it usually runs) you can get an idea of what's it doing:

{% highlight bash %}
# ps
PID   USER     TIME   COMMAND
    1 root       0:00 /sbin/runsvdir -P /etc/service/enabled
  105 root       0:00 runsv felix
  106 root       0:00 runsv bird
  107 root       0:00 runsv bird6
  108 root       0:00 runsv confd
  109 root       0:28 bird6 -R -s /var/run/calico/bird6.ctl -d -c /etc/calico/confd/config/bird6.cfg
  110 root       0:00 confd -confdir=/etc/calico/confd -interval=5 -watch --log-level=debug -node=http://etcd1:4001
  112 root       0:40 bird -R -s /var/run/calico/bird.ctl -d -c /etc/calico/confd/config/bird.cfg
  230 root      31:48 calico-felix
  256 root       0:00 calico-iptables-plugin
  257 root       2:17 calico-iptables-plugin
11710 root       0:00 /bin/sh
11786 root       0:00 ps
{% endhighlight %}

As you can see, it's connecting to the etcd nodes and reading from there, and it has a confd directory passed to it. The source of that confd directory can be found in the [calicoctl github repository](https://github.com/projectcalico/calico/tree/master/calico_node/filesystem/etc/calico/confd).

If you examine the repo, you'll notice three directories.

Firstly, there's a `conf.d` directory. This directory contains a bunch of toml configuration files. Let's examine one of them:

{% highlight go %}
[template]
src = "bird_ipam.cfg.template"
dest = "/etc/calico/confd/config/bird_ipam.cfg"
prefix = "/calico/v1/ipam/v4"
keys = [
    "/pool",
]
reload_cmd = "pkill -HUP bird || true"
{% endhighlight %}

This is pretty simple in reality. It has a source file, and then where the file should be written to. Then, there's some etcd keys that you should read information from. Essentially, confd is what writes the BIRD configuration for Calico. If you examine the keys there, you'll see the kind of thing it reads:

{% highlight bash %}
$  etcdctl ls /calico/v1/ipam/v4/pool/
/calico/v1/ipam/v4/pool/192.168.0.0-16
{% endhighlight %}

So in this case, it's getting the pod cidr we've assigned. I'll cover this in more detail later.

In order to understand what it does with that key, you need to take a look at the [src template confd is using](https://github.com/projectcalico/calico/blob/master/calico_node/filesystem/etc/calico/confd/templates/bird_ipam.cfg.template).

Now, this at first glance looks a little complicated, but it's not. It's writing a file in the Go templating language that confd is familiar with. This is a standard BIRD configuration file, populated with keys from etcd. Take [this](https://github.com/projectcalico/calico/blob/master/calico_node/filesystem/etc/calico/confd/templates/bird_ipam.cfg.template#L5-L8) for example:

This is essentially:

* Looping through all the pools under the key `/v1/ipam/v4/pool` - in our case we only have one: 192.168.0.0-16
* Assigning the data in the pools key to a var, `$data`
* Then grabbing a value from the JSON that's been loaded into `$data` - in this case the cidr key.

This makes more sense if you look at the values in the etcd key:

{% highlight bash %}
etcdctl get /calico/v1/ipam/v4/pool/192.168.0.0-16
{"cidr":"192.168.0.0/16","ipip":"tunl0","masquerade":true,"ipam":true,"disabled":false}
{% endhighlight %}

So it's grabbed the cidr value and written it to the file. The end result of the file in the calico/node container brings this all together:

{% highlight bash %}
if ( net ~ 192.168.0.0/16 ) then {
    accept;
  }
{% endhighlight %}

Pretty simple really!

## calico-felix
The final component in the calico stack is the calico-felix daemon. This is the tool that performs all the magic in the calico stack. It has multiple responsibilities:

* it writes the routing table of the operating system. You'll see this in action later
* it manipulates IPtables on the host. Again, you'll see this in action later.

It does all this by connecting to etcd and reading information from there. It runs inside the calico/node DaemonSet alongside confd and BIRD.

# Calico in Action
In order to get started, it's recommend that you've deployed Calico using the installation instructions [here](http://docs.projectcalico.org/v2.3/getting-started/kubernetes/installation/). Ensure that:

* you've got a calico/node container running on every kubernetes host
* You can see in the calico/node logs that there's no errors or issues. Use `kubectl get logs` on a few hosts to ensure it's working as expected

At this stage, you'll want to deploy something so that Calico can work it's magic. I recommend deploying the [guestbook](https://github.com/kubernetes/kubernetes/tree/master/examples/guestbook/all-in-one) to see all this in action.

## Routing Table
Once you've deployed Calico and your guestbook, get the pod IP of the guestbook using `kubectl`:

{% highlight bash %}
kubectl get po -o wide
NAME                           READY     STATUS    RESTARTS   AGE       IP                NODE
frontend-88237173-f3sz4        1/1       Running   0          2m        192.168.15.195    node1
frontend-88237173-j407q        1/1       Running   0          2m        192.168.228.195   node2
frontend-88237173-pwqfx        1/1       Running   0          2m        192.168.175.195   node3
redis-master-343230949-zr5xg   1/1       Running   0          2m        192.168.0.130    node4
redis-slave-132015689-475lt    1/1       Running   0          2m        192.168.71.1      node5
redis-slave-132015689-dzpks    1/1       Running   0          2m        192.168.105.65   node6
{% endhighlight %}

If everything has worked correctly, you should be able to ping every pod from any host. Test this now:

{% highlight bash %}
ping -c 1 192.168.15.195
PING 192.168.15.195 (192.168.15.195) 56(84) bytes of data.
64 bytes from 192.168.15.195: icmp_seq=1 ttl=63 time=0.318 ms

--- 192.168.15.195 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.318/0.318/0.318/0.000 ms
{% endhighlight %}

If you have [fping](http://fping.org/) and  installed, you can verify all pods in one go:

{% highlight bash %}
kubectl get po -o json | jq .items[].status.podIP -r | fping
192.168.15.195 is alive
192.168.228.195 is alive
192.168.175.195 is alive
192.168.0.130 is alive
192.168.71.1 is alive
192.168.105.65 is alive
{% endhighlight %}

The real question is, how did this actually work? How come I can ping these endpoints? The answer becomes obvious if you print the routing table:

{% highlight bash %}
ip route
default via 172.29.132.1 dev eth0
169.254.0.0/16 dev eth0  scope link  metric 1002
172.17.0.0/16 dev docker0  proto kernel  scope link  src 172.17.0.1
172.29.132.0/24 dev eth0  proto kernel  scope link  src 172.29.132.127
172.29.132.1 dev eth0  scope link
192.168.0.128/26 via 172.29.141.98 dev tunl0  proto bird onlink
192.168.15.192/26 via 172.29.141.95 dev tunl0  proto bird onlink
blackhole 192.168.33.0/26  proto bird
192.168.71.0/26 via 172.29.141.105 dev tunl0  proto bird onlink
192.168.105.64/26 via 172.29.141.97 dev tunl0  proto bird onlink
192.168.175.192/26 via 172.29.141.102 dev tunl0  proto bird onlink
192.168.228.192/26 via 172.29.141.96 dev tunl0  proto bird onlink
{% endhighlight %}

A lot has happened here, so let's break it down in sections.

### Subnets

Each host that has calico/node running on it has its own `/26` subnet. You can verify this by looking in etcd:

{% highlight bash %}
etcdctl ls /calico/ipam/v2/host/node1/ipv4/block/
/calico/ipam/v2/host/node1/ipv4/block/192.168.228.192-26
{% endhighlight %}

So in this case, the host node1 has been allocated the subnet `192.168.228.192-26`. Any new host that starts up, connects to kubernetes and has a calico/node container running on it, will get one of those subnets. This is a fairly standard model in Kubernetes networking.

What differs here is how Calico handles it. Let's go back to our routing table and look at the entry for that subnet:

{% highlight bash %}
192.168.228.192/26 via 172.29.141.96 dev tunl0  proto bird onlink
{% endhighlight %}

What's happened here is that calico-felix has read etcd, and determined that the ip address of node1 is `172.29.141.96`. Calico now knows the IP address of the host, and also the pod subnet assigned to it. With this information, it programs routes on _every node_ in the kubernetes cluster. It says "if you want to hit something in this subnet, go via the ip address `x` over the tunl0 interface.

The tunl0 interface _may not_ be present on your host. It exists here because I've enabled IPIP encapsulation in Calico for the sake of testing.

### Destination Host

Now, the packets know their destination. They have a route defined and they know they should head directly via the interface of the node. What happens then, when they arrive there?

The answer again, is in the routing table. On the host the pod has been scheduled on, print the routing table again:

{% highlight bash %}
ip route
default via 172.29.132.1 dev eth0
169.254.0.0/16 dev eth0  scope link  metric 1002
172.17.0.0/16 dev docker0  proto kernel  scope link  src 172.17.0.1
172.29.132.0/24 dev eth0  proto kernel  scope link  src 172.29.132.127
172.29.132.1 dev eth0  scope link
192.168.0.128/26 via 172.29.141.98 dev tunl0  proto bird onlink
192.168.15.192/26 via 172.29.141.95 dev tunl0  proto bird onlink
blackhole 192.168.33.0/26  proto bird
192.168.71.0/26 via 172.29.141.105 dev tunl0  proto bird onlink
192.168.105.64/26 via 172.29.141.97 dev tunl0  proto bird onlink
192.168.175.192/26 via 172.29.141.102 dev tunl0  proto bird onlink
192.168.228.192/26 via 172.29.141.96 dev tunl0  proto bird onlink
192.168.228.195 dev cali7b262072819  scope link
{% endhighlight %}

There's an extra route! You can see, there's the pod IP has the destination and it's telling the OS to route it via a device, `cali7b262072819`.

Let's have a look at the interfaces:

{% highlight bash %}
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
3: eth1: <BROADCAST,MULTICAST,SLAVE,UP,LOWER_UP> mtu 1500 qdisc mq master bond0 state UP mode DEFAULT qlen 1000
    link/ether 00:25:90:62:ed:c6 brd ff:ff:ff:ff:ff:ff
4: bond0: <BROADCAST,MULTICAST,MASTER,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT
    link/ether 00:25:90:62:ed:c6 brd ff:ff:ff:ff:ff:ff
5: cali7b262072819@if4: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT
    link/ether 32:e9:d2:f3:17:0f brd ff:ff:ff:ff:ff:ff link-netnsid 4
{% endhighlight %}

There's an interface for our pod! When the container spun up, calico (via [CNI](https://github.com/containernetworking/cni)) created an interface for us and assigned it to the pod. How did it do that?

## CNI

The answer lies in the setup of Calico. If you examine the yaml you installed when you installed Calico, you'll see a setup task which runs on every container. That uses a configmap, which looks like this

{% highlight yaml %}
# This ConfigMap is used to configure a self-hosted Calico installation.
kind: ConfigMap
apiVersion: v1
metadata:
  name: calico-config
  namespace: kube-system
data:
  # The location of your etcd cluster.  This uses the Service clusterIP
  # defined below.
  etcd_endpoints: "http://10.96.232.136:6666"

  # True enables BGP networking, false tells Calico to enforce
  # policy only, using native networking.
  enable_bgp: "true"

  # The CNI network configuration to install on each node.
  cni_network_config: |-
    {
        "name": "k8s-pod-network",
        "type": "calico",
        "etcd_endpoints": "__ETCD_ENDPOINTS__",
        "log_level": "info",
        "ipam": {
            "type": "calico-ipam"
        },
        "policy": {
            "type": "k8s",
             "k8s_api_root": "https://__KUBERNETES_SERVICE_HOST__:__KUBERNETES_SERVICE_PORT__",
             "k8s_auth_token": "__SERVICEACCOUNT_TOKEN__"
        },
        "kubernetes": {
            "kubeconfig": "/etc/cni/net.d/__KUBECONFIG_FILENAME__"
        }
    }

  # The default IP Pool to be created for the cluster.
  # Pod IP addresses will be assigned from this pool.
  ippool.yaml: |
      apiVersion: v1
      kind: ipPool
      metadata:
        cidr: 192.168.0.0/16
      spec:
        ipip:
          enabled: true
        nat-outgoing: true
{% endhighlight %}

This manifests itself in the `/etc/cni/net.d` directory on every host:
{% highlight bash %}
ls /etc/cni/net.d/
10-calico.conf  calico-kubeconfig  calico-tls
{% endhighlight %}

So essentially, when a new pod starts up, Calico will:

* query the kubernetes API to determine the pod exists and that it's on this node
* assigns the pod an IP address from within its IPAM
* create an interface on the host so that the container can get an address
* tell the kubernetes API about this new IP

Magic!

## IPTables

The final piece of the puzzle here is some IPTables magic. As mentioned earlier, Calico has support for network policy. Even if you're not actively _using_ the policy components, it still exists, and you need some default policy for connectivity is work. If you look at the output of `iptables -L` you'll see a familiar string:

{% highlight bash %}
**Chain felix-to-7b262072819 (1 references)
target     prot opt source               destination
MARK       all  --  anywhere             anywhere             MARK and 0xfeffffff
MARK       all  --  anywhere             anywhere             /* Start of tier default */ MARK and 0xfdffffff
felix-p-_722590149132d26-i  all  --  anywhere             anywhere             mark match 0x0/0x2000000
RETURN     all  --  anywhere             anywhere             mark match 0x1000000/0x1000000 /* Return if policy accepted */
DROP       all  --  anywhere             anywhere             mark match 0x0/0x2000000 /* Drop if no policy in tier passed */
felix-p-k8s_ns.default-i  all  --  anywhere             anywhere
RETURN     all  --  anywhere             anywhere             mark match 0x1000000/0x1000000 /* Profile accepted packet */
DROP       all  --  anywhere             anywhere             /* Packet did not match any profile (endpoint eth0) */
{% endhighlight %}

The IPtables chain here has the same string at the calico interface. This iptables rule is vital for calico to pass the packets onto the container. It grabs the packet destined for the container, determines if it should be allowed and sends it on its way if it is.

If this chain doesn't exist, it gets captured by the default policy, and the packet will be dropped. It's `calico-felix` that programs these rules.

# Wrap Up

Hopefully, you now have a better knowledge of how exactly Calico gets the job done. At its core, it's actually relatively simple, simply ip routes on each host. What it does it take the difficult in managing those routes away from you, giving you a simple, easy solution to container networking.


