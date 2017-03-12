---
title: An Introduction to Kubernetes FlexVolumes
layout: post
category: blog
tags:
- kubernetes
- volumes
- storage
- flexvolume
---

Kubernetes has a reputation for being great for stateless application deployment. If you don't require any kind of local storage inside your containers, the barrier to entry for you to deploy on Kubernetes is probably very, very low. However, it's a fact of life that some applications require _some_ kind of local storage.

Kubernetes supports this using [Volumes](https://kubernetes.io/docs/user-guide/volumes/) and out of the box there is support for more than enough volume types for the average kubernetes user. For example, if your kubernetes cluster is deployed to AWS, you're probably going to make use make use of the [awsElasticBlockStore](https://kubernetes.io/docs/user-guide/volumes/#awselasticblockstore) volume type, and think very little of it.

There are situations however, where you might be deploying your cluster to a different platform, like physical datacenters or perhaps another "cloud" provider like [DigitalOcean](https://www.digitalocean.com/). In these situations, you might think you're a little bit screwed, and up until recently you kind of were. The only way to get a new storage provider supported in Kubernetes was to write one, and then run the gauntlet of getting a merge request accepted into the main kubernetes repo. 

However, a new volume type has opened up the door to custom volume providers, and they are exceptionally simple to write and use. [FlexVolumes](https://github.com/kubernetes/kubernetes/blob/master/examples/volumes/flexvolume/README.md) are a relatively new addition to the kubernetes volume list, and they allow you to run an arbitrary script or volume provisioner on the kubernetes host to create a volume.

Before we dive too deep into FlexVolumes, it's worth refreshing exactly how volumes work on Kubernetes and how they are mapped into the container.

# Volumes Crash Course

If you've been using Volumes in Kubernetes in a cloud provider, you might not be fully aware of exactly how they work. If you are aware, I suggest you skip ahead. For those that aren't, let's have a quick overview of how EBS volumes work in Kubernetes.

## Create an EBS Volume.

The first thing you have to do is create an EBS volume. If you're using the [AWS CLI](https://aws.amazon.com/cli/) this is easy as:

{% highlight bash %}
aws ec2 create-volume --availability-zone eu-west-1c --size 10 --volume-type gp2
{% endhighlight %}

Which will return something like..

{% highlight bash %}
{
    "AvailabilityZone": "eu-west-1c",
    "Encrypted": false,
    "VolumeType": "gp2",
    "VolumeId": "vol-xxxxxxxxxxxxxxxxx",
    "State": "creating",
    "Iops": 100,
    "SnapshotId": "",
    "CreateTime": "2017-03-12T14:49:36.377Z",
    "Size": 10
}
{% endhighlight %}

Your EBS volume is now ready to go.

Once you have the volume, you'll probably want to attach it to a Kubernetes pod! In order to do this, you'll need to take the volume ID and use it in your kubernetes manifest. The [awsElasticBlockStore](https://kubernetes.io/docs/user-guide/volumes/#awselasticblockstore) has an example, like so:

{% highlight yaml %}
apiVersion: v1
kind: Pod
metadata:
  name: test-ebs
spec:
  containers:
  - image: gcr.io/google_containers/test-webserver
    name: test-container
    volumeMounts:
    - mountPath: /test-ebs
      name: test-volume
  volumes:
  - name: test-volume
    awsElasticBlockStore:
      volumeID: vol-xxxxxxxxxxxxxxxxx
      fsType: ext4
{% endhighlight %}

Now, if you look in the pod, you'll see a mount at `/test-ebs`, but how has it got there? The answer is actually surprisingly simple.

If you examine the ebs volume that was created, you'll see it's been attaced to an instance!

{% highlight bash %}
aws ec2 describe-volumes --volume-ids vol-xxxxxxxxxxxxxxxxx
{
    "Volumes": [
        {
            "AvailabilityZone": "eu-west-1c",
            "Attachments": [
                {
                    "AttachTime": "2017-03-12T14:53:55.000Z",
                    "InstanceId": "i-xxxxxxxxxxxxxxxxx", << --- attached to an instance
                    "VolumeId": "vol-xxxxxxxxxxxxxxxxx",
                    "State": "attached",
                    "DeleteOnTermination": false,
                    "Device": "/dev/xvdba"
                }
            ],
            "Encrypted": false,
            "VolumeType": "gp2",
            "VolumeId": vol-xxxxxxxxxxxxxxxxx",
            "State": "in-use",
            "Iops": 100,
            "SnapshotId": "",
            "CreateTime": "2017-03-12T14:49:36.377Z",
            "Size": 10
        }
    ]
}
{% endhighlight %}

So let's log into this host, and find the device:

{% highlight bash %}
findmnt /dev/xvdba
TARGET                                                                                               SOURCE     FSTYPE OPTIONS
/var/lib/kubelet/plugins/kubernetes.io/aws-ebs/mounts/vol-07420f271b73fcd44                          /dev/xvdba ext4   rw,relatime,data=ordered
/var/lib/kubelet/pods/b6c57370-0733-11e7-8421-06533dc554b3/volumes/kubernetes.io~aws-ebs/test-volume /dev/xvdba ext4   rw,relatime,data=ordered
{% endhighlight %}

As you can see here, it's mounted on the host under the `/var/lib/kubelet` directory. This gives us a clue as to how this happened, but to confirm, you can examine the kubelet logs and you'll see things like this:

{% highlight bash %}
Mar 12 14:54:11 ip-172-20-57-70 kubelet[1199]: I0312 14:54:11.716670    1199 operation_executor.go:832] MountVolume.WaitForAttach succeeded for volume "kubernetes.io/aws-ebs/vol-xxxxxxxxxxxxxxxxx" (spec.Name: "test-volume") pod "b6c57370-0733-11e7-8421-06533dc554b3" (UID: "b6c57370-0733-11e7-8421-06533dc554b3").
...
Mar 12 14:54:15 ip-172-20-57-70 kubelet[1199]: I0312 14:54:15.738019    1199 mount_linux.go:369] Disk successfully formatted (mkfs): ext4 - /dev/xvdba /var/lib/kubelet/plugins/kubernetes.io/aws-ebs/mounts/vol-xxxxxxxxxxxxxxxxx
{% endhighlight %}

The main point here is that when we provide a pod with a volume mount, it's the **kubelet** that takes care of the process. All it does it mount the external volume (in this case the EBS volume) onto a directory on the host (under the `/var/lib/kubelet` dir) and then from there, it can map that volume into the container. There isn't any fancy magic on the container side, it's essentially just a normal [docker volume](https://docs.docker.com/engine/tutorials/dockervolumes/) to the container.

# FlexVolumes examined

Okay, so now we know how volumes work in Kubernetes, we can start to examine how flexvolumes work.

FlexVolumes are essentially very simple script executed by the Kubelet on the host. The script should have 5 functions

* init - to initialize the volume driver. This could be just an empty function if needed
* attach - to attach the volume to the host. In many cases, this might be empty, but in some cases, like for EBS, you might have to make an API call to attach it to the host
*  mount - mount the volume _on_ the host. This is the important part, and is the part that makes the volume available to to the host to mount it in `/var/lib/kubelet`
*  unmount - hopefully self explanatory - unmount the volume
*  detach - again, hopefully self explanatory - detach the volume from the external host.

For each of these functions, there's some parameters passed to the function as scripts arguments (such as `$1`, `$2`, `$3`). 
The last passed argument is interesting, because it's actually a JSON string with options from the driver (more on this later) These parameters specify options that are important to the function, as as we examine a real world example they should become more clear.

## LVM Example

The kubernetes repo has a helpful [LVM example](https://github.com/kubernetes/kubernetes/blob/master/examples/volumes/flexvolume/lvm) in the form of a bash script, which makes it nice and readable and easy to understand. Let's look at some of the functions..

### Init

The init function is very simple, as LVM doesn't require and initialization:

{% highlight bash %}
if [ "$op" = "init" ]; then
	log "{\"status\": \"Success\"}"
	exit 0
fi
{% endhighlight %}

Notice how we're returning JSON here, which isn't much fun in bash!

### Attach

The attach function for the LVM example simply determines if the device exists. Because we don't have to do any API calls to a cloud provider, this makes it quite simple:

{% highlight bash %}
attach() {
	JSON_PARAMS=$1
	SIZE=$(echo $1 | jq -r '.size')

	DMDEV=$(getdevice)
	if [ ! -b "${DMDEV}" ]; then
		err "{\"status\": \"Failure\", \"message\": \"Volume ${VOLUMEID} does not exist\"}"
		exit 1
	fi
	log "{\"status\": \"Success\", \"device\":\"${DMDEV}\"}"
	exit 0
}
{% endhighlight %}

As you saw earlier, the LVM device needs to exist before we can mount it (in the EBS example earlier, we had to create the device) and so during the attach phase, we ensure the device is available.

### Mount

The final stage is the mount section.

{% highlight bash %}
domountdevice() {
	MNTPATH=$1
	DMDEV=$2
	FSTYPE=$(echo $3|jq -r '.["kubernetes.io/fsType"]')

	if [ ! -b "${DMDEV}" ]; then
		err "{\"status\": \"Failure\", \"message\": \"${DMDEV} does not exist\"}"
		exit 1
	fi

	if [ $(ismounted) -eq 1 ] ; then
		log "{\"status\": \"Success\"}"
		exit 0
	fi

	VOLFSTYPE=`blkid -o udev ${DMDEV} 2>/dev/null|grep "ID_FS_TYPE"|cut -d"=" -f2`
	if [ "${VOLFSTYPE}" == "" ]; then
		mkfs -t ${FSTYPE} ${DMDEV} >/dev/null 2>&1
		if [ $? -ne 0 ]; then
			err "{ \"status\": \"Failure\", \"message\": \"Failed to create fs ${FSTYPE} on device ${DMDEV}\"}"
			exit 1
		fi
	fi

	mkdir -p ${MNTPATH} &> /dev/null

	mount ${DMDEV} ${MNTPATH} &> /dev/null
	if [ $? -ne 0 ]; then
		err "{ \"status\": \"Failure\", \"message\": \"Failed to mount device ${DMDEV} at ${MNTPATH}\"}"
		exit 1
	fi
	log "{\"status\": \"Success\"}"
	exit 0
}
{% endhighlight %}

This is a little bit more involved, but still relatively simple. Essentially, what happens here is:
* The passed device is formatted to a filesystem provided in the parameters
* A directory is created to mount the volume to
* it's then mounted to a mountpath by the kubelet

### Parameters

You may be wondering, where do these parameters I keep talking about come from? The answer is from the pod manifest sent to the kubelet. Here's an example that uses the above LVM flexvolume:

{% highlight yaml %}
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: test
      mountPath: /data
    ports:
    - containerPort: 80
  volumes:
  - name: test
    flexVolume:
      driver: "leebriggs.co.uk/lvm"
      fsType: "ext4"
      options:
        volumeID: "vol1"
        size: "1000m"
        volumegroup: "kube_vg"
{% endhighlight %}

The key section here is the "options" section. This volume ID, size and volume group is all passed to the kubelet as `$3` as a JSON string, which is why there's a bunch of [jq](https://stedolan.github.io/jq/) munging happening in the above scripts.

# Using FlexVolumes
Now you understand how flexvolumes work, you need to make the kubelet aware of them. Currently, the only way to do this is to install them on the host under a specific directory.

FlexVolumes need a "namespace" (for want of a better word) and a name. So for example, my personally built lvm flexvolume might be `leebriggs.co.uk/lvm`. When we install our script, it needs to be installed like so on the host that runs the kubelet:

{% highlight bash %}
mkdir -p /usr/libexec/kubernetes/kubelet-plugins/volume/exec/leebriggs.co.uk~lvm
mv lvm /usr/libexec/kubernetes/kubelet-plugins/volume/exec/leebriggs.co.uk~lvm/lvm
{% endhighlight %}

Once you've done this, restart the kubelet, and you should be able to use your flexvolume as you need.

## Manifest

The manifest above give you an example of how to use flexvolumes. It's worth noting that not all flexvolumes will be in the same format though. Make sure the driver name matches the directory under the `exec` folder (in our case, `leebriggs.co.uk~lvm` and that you pass your required options around.

# Wrapping up

This was a relative crash course in FlexVolumes for Kubernetes. There are a couple problems with it:

* The example is written in bash, which isn't great at manipulating JSON
* It uses LVM, which isn't exactly multi host compatible

The first point is easily solved, by writing a driver in a language with JSON parsing built in. There are a few flexvolume drivers popping up in [Go](https://golang.org/) - [I wrote one](https://github.com/jaxxstorm/ploop-flexvol) for [ploop](https://openvz.org/Ploop) in Go using a [library](https://github.com/jaxxstorm/flexvolume) which was written to ease the process, but there are  others:

* Github user [TonyZuo](https://github.com/tonyzou/) has written a couple of interesting ones. One  for [DigitalOcean](https://www.digitalocean.com/) and one for [Packet](https://www.packet.net/). Check them out [here](https://github.com/tonyzou/flexvolumes)
* There's a [Rancher Flexvolume](https://github.com/rancher/rancher-flexvol) for those using Rancher
* Finally, one very interesting one is this [Vault Flexvolume](https://github.com/fcantournet/kubernetes-flexvolume-vault-plugin) which can map [Vault](https://vaultproject.io) to directories inside containers. 

All of this deals with mapping single, static volumes into containers, but there is more. Currently, you have to manually provision the volumes you use before spinning up a pod, and as you start to create more and more volumes, you may want to deal with [Persistent Volumes](https://kubernetes.io/docs/user-guide/persistent-volumes/) to have a process that automatically creates the volumes for you. My next post will detail how you can _use_ these flexvolumes in a custom provisioner which resembles the persistent volumes in AWS and GCE!
