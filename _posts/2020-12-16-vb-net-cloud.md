---
title: VB.NET - The Future of Infrastructure as Code
layout: post
category: blog
tags:
- tech
- pulumi
---

{% include note.html content="This post is about  [Pulumi](https://pulumi.com) who is now my employer. If you don't want to hear about that, look away now." %}
{% include note.html content="Some images have been redacted to protect the innocent" %}

I can remember the exact moment I first realized I _didn't_ want to be a software developer. It was May 2009, and I was desperately trying to finish my final University project for the module "object-orientated Programming."

My module tutor had tasked us with creating an application of our choosing in VB.NET. I can unapologetically say I didn't enjoy the process. I preferred focusing on systems, understanding how things fit together. I was spending my days getting stuck in the minutiae of fixing bugs in my code.

My career progression from there followed a fairly traditional "System Administrator" path. I managed some Linux servers, the number grew, and I went headfirst into configuration management. As the DevOps movement came around, I embraced Kubernetes early and spent several years using cutting edge technologies in exciting ways. Despite telling myself in 2009 I didn't want to be a software engineer, in 2020 I got my first "software engineer" title here at Pulumi, and now I'm lucky enough to spend my time writing code to program the cloud. 

# Revisiting the Past

[Pulumi](https://pulumi.com) is an exciting product, but what's incredible to see working here is how the platform scales. All of the [Pulumi provider](https://www.pulumi.com/docs/intro/cloud-providers/) SDKs get programmatically generated, which means that once support for a language gets added, all of the available providers will get that SDK generated. Adding a new language has significant engineering work up front, of course, but ongoing maintenance burden drops over time rather than increases. 

In November 2019, Pulumi added support for the [.NET core languages](https://www.pulumi.com/blog/pulumi-dotnet-core/). We've seen significant adoption from the .NET community, and if you take a look at our [examples repo](https://github.com/pulumi/examples), you'll see dozens of examples of creating cloud infrastructure with [C#](https://en.wikipedia.org/wiki/C_Sharp_(programming_language)) and [F#](https://en.wikipedia.org/wiki/F_Sharp_(programming_language)), the flagship languages of the .NET framework.

Of course, .NET core languages also include my trusty old friend VB.NET. I haven't written a single line of VB.Net since I handed in my university project in 2009, and I have a vague recollection that I told myself that I never would again. 

However, this is 2020. So I asked myself, what is the very last thing I would want to create with Pulumi in VB.NET. The answer is obvious, of course - Kubernetes resources.

# The old and the new

In many ways, VB.NET and Kubernetes couldn't be further apart. VB.NET, of old Microsoft - a language of "[code-behind](https://en.wiktionary.org/wiki/code-behind)", written for the era of monolithic desktop apps and windows forms and [Kubernetes](https://kubernetes.io/), a complex distributed system written to be [cloud-native](https://www.cncf.io/). 

With nostalgia in mind, I asked in our internal slack just how good our VB.NET support was. I quickly got a helpful answer from one of our [resident .NET experts](https://twitter.com/mikhailshilkov) which can when summarized is along the lines of:

> It should work, but...why?

The answer to that question in my mind was of course, because it's 2020.
Our [Pulumi templates](https://github.com/pulumi/templates/) (used to bootstrap new Pulumi projects) helpfully already had [VisualBasic examples](https://github.com/pulumi/templates/tree/master/aws-visualbasic). I imagine they're lonely, because I couldn't find a single record of them ever getting used.

Bootstrapping my new cloud VB.NET project, I could feel the old familiarity of hating being a software developer return to me. Shaking off the innate feeling, I set about doing the Pulumi equivalent of "Hello, world" - creating an S3 bucket in AWS.

```vb
Imports Pulumi
Imports Pulumi.Aws.S3

Class MyStack
    Inherits Stack

    Public Sub New()
        ' Create an AWS resource (S3 Bucket)
        Dim bucket = New Bucket("my-bucket")

        ' Export the name of the bucket
        Me.BucketName = bucket.Id
    End Sub

    <Output>
    Public Property BucketName As Output(Of String)
End Class
```

I sort of hoped it would fail. VB.Net is 19 years old. Surely it has no place provisioning AWS resources?

I had some difficulty familiarizing myself with the syntax, but after yelling at my IDE a couple times, I finally managed to get my S3 bucket created.

At this point, I decided to antagonize the internet and rehash a meme from earlier in the year:

![Meme](/img/vb-net-tweet-1.png)

The responses I received weren't surprising:

![Twitter](/img/vb-net-tweet-2.png)

Undeterred, I went for broke. Adding the Kubernetes provider and building out the required resources to deploy to an already provisioned EKS cluster was easier than I expected. I actually started to feel like the syntax of VB.net felt oddly suited to the task. It looks.... good?

```vb
Imports Pulumi.Kubernetes.Apps.V1
Imports Pulumi.Kubernetes.Core.V1
Imports Pulumi.Kubernetes.Types.Inputs.Apps.V1
Imports Pulumi.Kubernetes.Types.Inputs.Core.V1
Imports Pulumi
Imports Pulumi.Kubernetes.Types.Inputs.Meta.V1

Class NginxStack 
  Inherits Stack

  Public Sub New()    
    
    ' an input map of labels
    Dim labels = New InputMap(Of String) From {"app", "nginx"}
    
    ' define the deployment spec
    Dim containerPortArgs = New ContainerPortArgs With { .ContainerPortValue = 80 }
    Dim containerArgs = New ContainerArgs With { 
          .Image = "nginx",
          .Name = "nginx",
          .Ports = containerPortArgs }
    Dim podSpecArgs = New PodSpecArgs With { .Containers = containerArgs }
    Dim template = New PodTemplateSpecArgs With { .Spec = podSpecArgs, .Metadata = New ObjectMetaArgs With { .Labels = labels } }
    Dim labelSelectorArgs = New LabelSelectorArgs With { .MatchLabels = labels }
    Dim deploymentSpecArgs = New DeploymentSpecArgs With { 
          .Template = Template,
          .Replicas = 2,
          .Selector = labelSelectorArgs}
    
    ' create the actual deployment
    Dim deployment = New Pulumi.Kubernetes.Apps.V1.Deployment("nginx", New DeploymentArgs With { .Spec = deploymentSpecArgs })
    
    ' define the service spec
    Dim servicePortArgs = New ServicePortArgs With { .Port = 80, .TargetPort = 80 }
    Dim serviceSpecArgs = New ServiceSpecArgs With { .Ports = servicePortArgs, .Type = "LoadBalancer", .Selector = labels }
    Dim objectMetaArgs = New ObjectMetaArgs With { .Name = "nginx", .Labels = labels }
    
    ' create a service
    Dim svc = New Pulumi.Kubernetes.Core.V1.Service("nginx", New ServiceArgs With { .Metadata = objectMetaArgs, .Spec = serviceSpecArgs } )
    
    Address = svc.Status.Apply(Function(status) If(status.LoadBalancer.Ingress(0).Ip, status.LoadBalancer.Ingress(0).Hostname))
        
  End Sub
  
  <Output>
  Public Property Address As Output(Of String)
End Class
```

I shared what I'd done with some of the Slack communities I frequent:

![Slack](/img/vb-net-slack-1.png)

I knew what I was doing was a little controversial, but I wasn't ready for this:

![Slack](/img/vb-net-slack-2.png)

I felt defensive all of a sudden. Was I starting to feel defensive of VB.NET?

Luckily, [the CEO of Pulumi](https://twitter.com/funcOfJoe/), a man who knows a thing or two about programming languages saw my example code and saw the beauty of what I'd done:

![Joe](/img/vb-net-twitter-3.png)

Not everyone saw the inner-beauty:

![Email](/img/vb-net-email-1.png)

You can see this incredible collaboration of old and new here:

[![asciicast](https://asciinema.org/a/Uq17k64ym5x4tl2aLmTFRg3i0.svg)](https://asciinema.org/a/Uq17k64ym5x4tl2aLmTFRg3i0)

The full code, if you'd like to see it, is [here](https://github.com/jaxxstorm/eks-vb-net)

If you'd ask me what I learned from this experience, I'd be honest and say - nothing. Do I really believe VB.NET is the future of cloud engineering? No. It's not. I'm unlikely to recommend to Pulumi customers that they break out Visual Studio and write some VB.NET, but we know the options is there if they ever want to use it.

I've gone on record before to talk about how much I [loathe templating YAML]({% post_url 2019-02-07-why-are-we-templating-yaml %}) and I love the expressibility Pulumi gives me with familiar programming languages. Even though I hated VB.NET in university, I would still prefer to express my cloud resources with a 19-year-old programming language over a configuration language with template replacement.
