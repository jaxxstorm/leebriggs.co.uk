---
title: "Why in the hell is your Kubernetes control plane public?"
layout: post
category: blog
tags:
- tailscale
- kubernetes
- devops
---

If you run the following command, you should see the health of your Kubernetes control plane:

```bash
curl -k $(kubectl config view --output jsonpath='{.clusters[*].cluster.server}')/healthz
```

Assuming everything is working as expected, it should return `ok`.

The real question though, is did you have to do anything _before_ running that command? Did you have to set up a VPN? Did you have to SSH into a bastion host? Did you have to do anything _other_ than just run the command?

If not, it's because your Kubernetes API servers are accessible on the public internet. How did I know that? Almost everyone is.

If you search [shodan.io for Kubernetes clusters](https://www.shodan.io/search?query=kubernetes) you'll see there's almost 1.4 million clusters just like yours.

For reasons I can't quite understand, we've sort of collectively decided that it's okay to put our Kubernetes control planes on the public internet. At the very least, we've sort of decided it's okay to give them a public IP address - sure you might add some security groups of firewall rules from specific IP addresses, but the control plane is still accessible from the internet.

To put this into some sort of perspective, how many of the people reading this get a cold shudder when they think about putting their database on the public internet? Or a windows server with RDP? Or a Linux server with SSH?

Established practices say this is generally not a good idea, and yet in order to make our lives easier, we've decided that it's _okay_ to let every person and their dog free access to try and make our clusters theirs.

## Private Networks

As soon as you put something in a private subnet in the cloud, you add a layer of complexity to the act of actually using it.
You have to explain to everyone who needs access to it, including that developer who's just joined the team, where it is and how to use it. You might use an SSH tunnel, or a bastion instance, or god forbid that VPN server someone set up years ago that nobody dares touch. 

We sort of accept these for things like databases because we very rarely need to get into them except in case of emergency, and we think it's okay to have to route through something else because the data in them is important enough to protect.

In addition to this, when cloud providers started offering managed Kubernetes servers, most of them didn't even _have_ private control planes. It was only in the last few years that they started offering this as a feature, and even then, it's not the default.

So the practice of putting a very important API on the internet has proliferated because it's just _easier_ to do it that way. The real concern here is that we're one severe vulnberability from having a bitcoin miner on every Kubernetes cluster on the internet.

## An alternative

I [previously]({% post_url 2024-02-26-cheap-kubernetes-loadbalancers %}) wrote about the [Tailscale Kubernetes Operator](https://tailscale.com/kb/1236/kubernetes-operator) and its ability to expose services running inside your Kubernetes cluster to your Tailnet, but it has another amazing feature:

It can act as a Kubernetes proxy for your cluster.

## Say what now?

Well, let's say you provision a Kubernetes cluster in AWS. You decide that you that in order to give yourself another layer of protection, you're going to make sure the control plane is only accessible within the VPC.

If you install the Tailscale Kubernetes operator and set the `apiServerProxyConfig` flag, it'll create a device in your Tailnet that makes it accessible to anyone on the tailnet. This means before you're able to use the cluster, you need to be connected to the Tailnet. All of that pain I mentioned previously with Bastion hosts and networking just vanishes into thin air.

Let's take it for a spin!

## Installing and using the Tailscale Operator

### Prerequisites

You'll need to have your own Tailnet, and be connected to it. You can [sign up for Tailscale](https://login.tailscale.com/start?utm=leebriggs.co.uk) and it's free for personal use.

Once that's done, you'll need to make a slight change to your ACL. The Kubernetes operator uses Tailscale's tagging mechanism so let's create a tag for the operator to use, and then a tag for it to give to client devices it registers:

```json
"tagOwners": {
		"tag:k8s-operator":           ["autogroup:admin"], // allow anyone in admin group to own the k8s-operator tag
		"tag:k8s":                    ["tag:k8s-operator"],
	},
```

Then, register an oauth client with `Devices` write scope and the `tag:k8s-operator` tag.

### Step 1: Get a Kubernetes Cluster

There's a lot of ways to do this, choose the way you prefer. If you're a fan of eksctl, [this page](https://eksctl.io/usage/eks-private-cluster/) shows you how to create a fully private cluster.

You can of course use the defaults and try this out with a public cluster if you like, but I'm going to assume you're doing this because you want to make your cluster private.

You may have to do this from inside your actual VPC, because remember, any post install steps that interact with the Kubenrnetes API server won't work. I leverage a [Tailscale Subnet Router](https://tailscale.com/kb/1019/subnets) to make this easier, more on this later.

### Step 2: Install the Tailscale Kubernetes Operator

The easiest way to do this is with [Helm](https://tailscale.com/kb/1236/kubernetes-operator#installation). You'll need to add the Tailscale Helm repository:

```bash
helm repo add tailscale https://pkgs.tailscale.com/helmcharts
helm repo update
```

Then install the operator with your oauth keys from the prerequites step, and enable the proxy:

```bash
helm upgrade \
  --install \
  tailscale-operator \
  tailscale/tailscale-operator \
  --namespace=tailscale \
  --create-namespace \
  --set-string oauth.clientId=${OAUTH_CLIENT_ID}> \
  --set-string oauth.clientSecret=${OAUTH_CLIENT_SECRET} \
  --set-string apiServerProxyConfig.mode="true" \
  --wait
```

Now, if you look at your Tailscale dashboard, or use `tailscale status` you should see a couple of new devices - the operator and a service just for the API server proxy.

You can now access your Kubernetes cluster from anywhere that has a Tailscale client installed, no faffing required.

### Step 3: Use it

You'll need to configure your `KUBECONFIG` using the following command:

```
tailscale configure kubeconfig <hostname>
```

This will set up your `KUBECONFIG` to use the Tailscale API server proxy as the server for your cluster. If you example your `KUBECONFIG` you should see something like this:

```yaml
apiVersion: v1
clusters:
- cluster:
    server: https://eks-operator-eu.tail5626a.ts.net
  name: eks-operator-eu.tail5626a.ts.net
contexts:
- context:
    cluster: eks-operator-eu.tail5626a.ts.net
    user: tailscale-auth
  name: eks-operator-eu.tail5626a.ts.net
current-context: eks-operator-eu.tail5626a.ts.net
kind: Config
users:
- name: tailscale-auth
  user:
    token: unused
```

## Hang on a minute..

You probably have some questions. Firstly, what's that `unused` token all about? What does `noauauthmodeth` mean in our operator installation? How does this work?

Well, if you run a basic `kubectl` command now (and assuming you're connected to your Tailnet) you'll get something back, but it won't help much:

```bash
kubectl get nodes
error: You must be logged in to the server (Unauthorized)
```

What's happened here? Well, the good news is, we've been able to route to our private Kubernetes control plane, but we're not sending any information back to about who we are. So let's make a small change to our Tailscale ACL in the Tailscale console. Add the following:

```json
	"grants": [
		{
			"src": ["autogroup:admin"], // allow any tailscale admin
			"dst": ["tag:k8s-operator"], // to contact any device tagged with k8s-operator
			"app": {
				"tailscale.com/cap/kubernetes": [{
					"impersonate": {
						"groups": ["system:masters"], // use the `system:masters` group in the cluster
					},
				}],
			},
		},
	],
```

By adding this grant, I'm assuming you're an admin of your Tailnet.

Now, give that `kubectl` command another try.

```bash
kubectl get nodes
NAME                                              STATUS   ROLES    AGE     VERSION
ip-172-18-183-129.eu-central-1.compute.internal   Ready    <none>   13h     v1.29.0-eks-5e0fdde
ip-172-18-187-244.eu-central-1.compute.internal   Ready    <none>   3d18h   v1.29.0-eks-5e0fdde
ip-172-18-42-205.eu-central-1.compute.internal    Ready    <none>   3d18h   v1.29.0-eks-5e0fdde
```

That's more like it.

As you can see here, I've solved two distinct problems:

- I've made my public Kubernetes control plane accessible over a VPN, without needing to worry about routing and networking - Tailscale has handled it for me.
- I've also been able to leveraging Tailscale's ACL mechanism to provide authentication to Kubernetes groups in a clusterrolebinding.

### noauth Mode

Now, if you're already happy with your current authorization mode, you can still use Tailscale's access mechanism to solve the routing problem. In this particular case, you'd install the Operator in `noauth` mode and then use your cloud providers existing mechanism to retrieve a token.

Modify your Tailscale Operator installation like so:

```bash
helm upgrade \
  --install \
  tailscale-operator \
  tailscale/tailscale-operator \
  --namespace=tailscale \
  --create-namespace \
  --set-string oauth.clientId=${OAUTH_CLIENT_ID}> \
  --set-string oauth.clientSecret=${OAUTH_CLIENT_SECRET} \
  --set-string apiServerProxyConfig.mode="noauth" \ # using noauth mode
  --wait
```

Once that's installed, if you run your `kubectl` command again, you'll see a different error message:

```
kubectl get nodes
Error from server (Forbidden): nodes is forbidden: User "jaxxstorm@github" cannot list resource "nodes" in API group "" at the cluster scope
```

The reason for this is a little obvious, the EKS cluster I'm using has absolutely no idea who `jaxxstorm@github` is - because it uses IAM to authenticate me to the cluster.

So let's modify our `KUBECONFIG` to retrieve a token as EKS expects. We'll modify the `user` section to leverage an `exec` directib - it should look a little bit like this:

```yaml
apiVersion: v1
clusters:
- cluster:
    server: https://eks-operator-eu.tail5626a.ts.net
  name: eks-operator-eu.tail5626a.ts.net
contexts:
- context:
    cluster: eks-operator-eu.tail5626a.ts.net
    user: tailscale-auth
  name: eks-operator-eu.tail5626a.ts.net
current-context: eks-operator-eu.tail5626a.ts.net
kind: Config
users:
- name: tailscale-auth
  user:
    exec:
      apiVersion: "client.authentication.k8s.io/v1beta1"
      command: "aws"
      args: [
        "eks",
        "get-token",
        "--cluster-name",
        "kc-eu-central-682884c" # replace with your cluster name
      ]
      env:
      - name: KUBERNETES_EXEC_INFO
        value: '{\"apiVersion\": \"client.authentication.k8s.io/v1beta1\"}'
```

Now we're able to route to the Kubernetes control plane, and authenticate with it using the cloud providers authorization mechanism.

## Some FAQs

### Why wouldn't I just use a Subnet Router?

A common question I get asked is why wouldn't I just use a subnet router in the VPC to route anything to the private address of the control plane? I leveraged this mechanism when I installed the operator, because my control plane was initially unrouteable from the internet anyway.

This is a legimate solution to the problem, and if you don't want to use the operator in `auth` mode, keep living your life. However, one benefit you get by installing the operator and talking directly to it via your `KUBECONFIG` is being able to use Tailscale's ACLs to dictate who can actually communicate with the operator.

If you recall our `grant` from earlier, we were able to dictate who was able to impersonate users inside the cluster in `auth` mode, but with Tailscale's ACL system we can also be prescriptive about connectivity. Consider if you removed the default, permissive ACL

```json
//{"action": "accept", "src": ["*"], "dst": ["*:*"]}, # commented out because hujson
```

Then defining a group of users who can access the cluster, and adding a more explicit ACL:

```json
"groups": {
		"group:engineers": ["jaxxstorm@github"],
	},
  // some other stuff here
"acls": [
		// Allow all connections.
		//{"action": "accept", "src": ["*"], "dst": ["*:*"]},
		{
			"action": "accept",
			"src":    ["group:engineers"],
			"dst":    ["tag:k8s-operator:443"],
		},
	],
```

I can be much more granular about my access to my cluster, and have a Zero Trust model for my Kubernetes control plane at the _network_ level as well as the authorization level. Your information security team will _love_ you.

When you provision the operator in the cluster, you can modify the tags it uses to even further allow segment your Tailnet, see the [operator config in the Helm chart's values.yaml](https://github.com/tailscale/tailscale/blob/main/cmd/k8s-operator/deploy/chart/values.yaml#L23)

Just remember to ensure your oauth clients has the correct permissions to manage those tags!

### Can I scope the access on the cluster side?

If you have the operator installed in `auth` mode, you can scope the access both at the network level (using the aforementioned tags) _and_ the Kubernetes RBAC system.

Let's say we want to give our aforementioned engineers group access to only a single namespace called `demo`.

First, we'd create the ClusterRole (or Role) and then cluster role binding:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: engineers-clusterrole
rules:
- apiGroups: ["", "apps", "batch", "extensions"] 
  resources: ["*"]
  verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: engineers-rolebinding
  namespace: demo
subjects:
- kind: Group
  name: engineers # note the group name here
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: engineers-clusterrole
  apiGroup: rbac.authorization.k8s.io
```

Then update our Tailscale ACL to modify the grants:

```json
"grants": [
		{
			"src": ["group:engineers"],
			"dst": ["tag:k8s-operator"],
			"app": {
				"tailscale.com/cap/kubernetes": [{
					"impersonate": {
						"groups": ["engineers"],
					},
				}],
			},
		},
	],
```

Now, if I try to access the `demo` namespace, I can do the stuff I need to do:

```bash
kubectl get pods -n demo
NAME                                     READY   STATUS    RESTARTS   AGE
demo-streamer-e3a170e4-85f4f7b88-gppcn   1/1     Running   0          16h
demo-streamer-e3a170e4-85f4f7b88-xc7gz   1/1     Running   0          16h
```

But not in the `kube-system` namespace:

```
 kubectl get pods -n kube-system
Error from server (Forbidden): pods is forbidden: User "jaxxstorm@github" cannot list resource "pods" in API group "" in the namespace "kube-system"
```

## Wrap Up

As always with the posts I write on here, I'm writing in my personal capacity, but obviously I'm a Tailscale employee with a vested interest in the success of the company. Do I want you to sign up for Tailscale and pay us money? You bet I do. Do I want you to get your Kubernetes clusters off the public internet even if you _don't_ want to sign up for Tailscale and pay us money? **Yes**.

I've always had an uneasy feeling about these public clusters, and I can't help but feel we're one RCE away from a disaster.

So now you now how easy it is to get your Kubernetes control plane off the internet, what are you waiting for? 