In a previous post, I covered the way you can take advantage of your existing storage infrastructure with flexvolumes, and quickly covered how to write an initialize one. 

If you're looking to use an existing storage solution in your kubernetes cluster, you'd be forgiven for thinking that's all you need - a flexvolume driver. Unfortunately, using a flexvolume driver isn't really enough to use _persistent_ volumes in Kubernetes, for a couple of reasons.

* If you have multiple pods (say, in a deployment or replica set) you can't specify a volume for each pod that gets created, because using the previous flexvolume examples, you're hardcoding paths
* By using FlexVolumes, Kubernetes isn't really "aware" of the volume you created. The storage provider is, but you're leaving it up to that to manage the volume, which isn't always a good idea

Kubernetes has a solution for this in cloud environments in the form of persistent volumes and persistent volume provisioners. Now, that's not to say the volume we created with our flexvolumes are not persistent, they might well be, but with the persistent volume resource in kubernetes, our cluster becomes aware of them and can manage them like any other resource. It's capable of knowing which pod is consuming a volume (using persistent volume claims) and also reuse volumes elsewhere.

# In tree & out of tree persistent volume provisioners

As mentioned in my previous post, there are lots of provisioners that are _in tree_ - that is to say, the code for the provisioner lives inside the kubernetes main source code, and it's a first class citizen. The list of these basically align with the [persistent volumes](https://kubernetes.io/docs/user-guide/persistent-volumes/) that you can use by default. However, with the introduction of FlexVolumes, persistent volumes became an _out of tree_ resource, in that you can provisioner them with code that doesn't live inside the kubernetes main github repo.

In order to ensure that the persistent volume provisioners (are you keeping up?!) were able to operate out of tree as well, a new kubernetes-incubator [github repo](https://github.com/kubernetes-incubator/external-storage/) was started which has several out of tree provisioners for storage. These provisioners essentially run as out of band services, which connect to the API and give you the ability to provisioner storage resources dynamically as the cluster needs them. The lifecycle of this looks a little bit like this:

1. A pod requests some storage as part of its spec
2. This becomes a resource in the kubernetes API
3. The persistent volume resource is read by the provisioner and it says "oh hey, I need to create a 20Gb disk of type "flexvolume"
4. The provisioner initiates the provision method, and creates the volume for you
5. Once the volume is created, a persistent volume _claim_ is created which can be consumed by a pod
6. The claim is attached to a pod and becomes part of its spec
7. The pod uses your fancy flexvolume driver to _mount_ the storage to it, and the cycle is complete

Now, all of this seems particularly involved, but in reality it's not. In order to understand what's actually happening here, let's go through one of the examples in the kubernetes-incubator project with something everyone understand - the [nfs-provisioner](http://)Now, all of this seems particularly involved, but in reality it's not. In order to understand what's actually happening here, let's go through one of the examples in the kubernetes-incubator project with something everyone understand - the [hostpath-provisioner](https://github.com/kubernetes-incubator/nfs-provisioner/tree/master/demo/hostpath-provisioner)

# Trying out the hostpath-provisioner
The hostpath provisioner is a super, super simple implementation of a provisioner that can run in kubernetes. It runs as a pod which reads the API, and all it does is make a directory on the host for you. Obviously, with that in mind, this demo is only useful on singly nodes kubernetes clusters, but it serves as a simple example of the way this can be done.

**Note: It's assumed at this point you have _some_ knowledge of Go. If not, this may end up being confusing**

## Provisioner methods

Most of the code in the provisioner is setup code. You can see [here](https://github.com/kubernetes-incubator/nfs-provisioner/blob/master/demo/hostpath-provisioner/hostpath-provisioner.go#L27-L34) a struct is created to define the id of the provisioner, as well as a directory to create all the new dynamically created volumes. The main thing we want to look at here is the [provision method](https://github.com/kubernetes-incubator/nfs-provisioner/blob/master/demo/hostpath-provisioner/hostpath-provisioner.go#L46)

There are [two lines of code[(https://github.com/kubernetes-incubator/nfs-provisioner/blob/master/demo/hostpath-provisioner/hostpath-provisioner.go#L47-L51) here which are very very obvious:

{% highlight go %}
path := path.Join(p.pvDir, options.PVName)

	if err := os.MkdirAll(path, 0777); err != nil {
		return nil, err
	}
{% endhighlight %}

This is doing exactly what you probably initially thought - it's creating a directory! It's getting the original pvDir (that we defined earlier in the config) and then the volume options (in our case, the name of the directory) and then doing a `MkdirAll`. 

