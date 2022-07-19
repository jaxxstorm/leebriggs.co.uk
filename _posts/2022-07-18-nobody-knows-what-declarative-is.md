---
title: Why does nobody seem to know what declarative actually means?
layout: post
category: blog
tags:
- devops
- infrastructure-as-code
- declarative
---

{% include note.html content="If you read the title and thought 'I know what declarative means!' note that I'm employing hyperbole as a [comedic device](https://en.wikipedia.org/wiki/Comedic_device) and obviously lots of people know what declarative means" %}

Like all tech employees, I've had feedback and performance reviews my whole career which varied from "you're doing a great job" to "Stop. Just stop doing that". I like to believe there's things I've addressed, and like all human being there are things I'll continue to work and never really get the hang of.

One piece of feedback I've had my entire career is that I "care too much". Now, this isn't like one of those awful interview question responses where someone says "they're too hard working" or they're "too much of a perfectionist" - it's very valid feedback that I desperately need to address.

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">I loved <a href="https://twitter.com/ConHome?ref_src=twsrc%5Etfw">@ConHome</a> question to Tory candidates about their greatest weakness. <a href="https://twitter.com/RishiSunak?ref_src=twsrc%5Etfw">@RishiSunak</a> is way too diligent, <a href="https://twitter.com/trussliz?ref_src=twsrc%5Etfw">@trussliz</a> is too enthusiastic, <a href="https://twitter.com/TomTugendhat?ref_src=twsrc%5Etfw">@TomTugendhat</a> is too loyal to the army, <a href="https://twitter.com/PennyMordaunt?ref_src=twsrc%5Etfw">@PennyMordaunt</a> is too much of a team player and <a href="https://twitter.com/KemiBadenoch?ref_src=twsrc%5Etfw">@KemiBadenoch</a> is way too funny. Such self knowledge!</p>&mdash; Robert Peston (@Peston) <a href="https://twitter.com/Peston/status/1547934205702615046?ref_src=twsrc%5Etfw">July 15, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

What people _actually_ mean when they tell me I care too much is that I concern myself with things outside the scope of my day to day job. My job at Pulumi is to help customers and potential customers see the value in the product. As a result, I see a lot of naysayers and objectionist who truly believe that Pulumi is just flat out wrong. A lot of this is just par for the course: not everyone is going to love your product and appreciate it. 

There's one thing though that I just can't let go of. One point of frustration that increases my blood pressure and has me reaching for the bourbon bottle every single time I read it.  I spend countless hours arguing with people on the internet about it.

![XKCD](https://imgs.xkcd.com/comics/duty_calls.png)

That thing is both important to my job but I also should probably care less.

That thing is:

Nobody seems to know what the fuck "declarative" _actually_ means.

## It's imperative we address this

When talking about infrastructure as code, you'll often hear the term "declarative" very early in the conversation. As I've said multiple times before, we as an industry have essentially settled on the idea that in order to provide a solution that's easy to use, it _must_ be declarative.

I alluded to this in a previous blog post about Pulumi misconceptions. This one comes up _so often_ that it has lead me to believe I "care too much" about it.

### You're overexagerrating. It doesn't happen that often..

Oh no. You're wrong. It happens _constantly_.

It happens on Twitter (feel free to search "pulumi" "imperative" for more):

![Twitter](/img/declarative-twitter.png)

It happens on Reddit:

![Reddit](/img/declarative-reddit.png)

You can even see it on blog posts by engineers with lots certificates at well regarded consulting organisations:

![Blog](/img/declarative-blog.png)

There are even YouTube videos with thousands of views saying the same thing.

I want to start by stating that I _understand_ why people make this mistake. I totally get it. What really irks me is that people will double down when engaged in conversation, and they'll continually use it as a reason to use Terraform over a CDK and Pulumi even though it's just flat out wrong.

## Okay, what's going on then?

The problem really seems to stem from the Terraform community. Unless I'm mistaken, Terraform was the first tool to really drive home the importance of defining infrastructure declaratively. Terraform's DSL, [HCL](https://github.com/hashicorp/hcl), allows users to define infrastructure with a configuration language that originally had no conditionals. You could state how you want your infrastructure to look in HCL, and Terraform handles all the logic for you. It figures out if something exists (which can be boiled down to an imperative "if" statement behind the scenes), and if it doesn't will go ahead and create it for you.

Terraform making use of a declarative engine while _also_ using a configuration language for its infrastructure definitions appears to have created a situation where people consider anything defined in a configuration language "declarative".

I cannot state this more clearly and without any less reservation.

If you think something using a configuration language makes something declarative, you are wrong. 

## What is declarative really?

The simple definition of declarative is this: if you can run the tool more than once and get the same result, you're dealing with a declarative tool. If you're about to hold your finger up and say "that's actually the definition of idempotent Lee", we're going to come back to this simple definition in a moment, hold your horses.

![Speechless](https://i.imgur.com/YAGpXPdh.jpg)

The _proper_ definition of declarative in the context of these tools is very well defined. So well defined in fact that it's a mathematical concept.

Declarative tools create a DAG, or a [directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph).

### Hold on poindexter, what the hell is a DAG?

Well, I'll start by saying I'm not a mathematician (side note: I got my calculator out yesterday to add a 10% tip for dinner, not my proudest moment) but I do have a very general idea of what a DAG is.

The simplest and best way to break down what a constitues a "DAG" is to examine each word on its own. I'll shamelessly steal from [this StackOverflow answer](https://stackoverflow.com/a/2283770/645002) as it does a way better job of defining it than me.

  - graph = structure consisting of nodes, that are connected to each other with edges
  - directed = the connections between the nodes (edges) have a direction: A -> B is not the same as B -> A 
  - acyclic = "non-circular" = moving from node to node by following the edges, you will never encounter the same node for the second time.

If you put this into the concept of an infrastructure as code program whether that be in Terraform, Pulumi, CloudFormation, CDK or any other declarative tool you can think of it like this; each of the "resources" you're defining in the program are a node. Any dependencies between those nodes (for example, the S3 Bucket Policy requires the S3 Bucket to exist) are _directed_ and finally, you cannot create a circular dependency.

Terraform makes this very very easy to understand because of its configuration language authoring experience, but Pulumi, AWS CDK and other infrastructure as code programs do **exactly the same thing**.

What's really nice about Pulumi and Terraform is that they actually allow you to _examine_ the graph that's built! Pulumi has the `pulumi stack graph` command and Terraform has the `terraform graph` command.

### What about that simple definition earlier?

A few moments ago, I said the simple definition of a declarative tool was that it has the same result if you run it over and over again. That isn't always true, because there are tools out there that _do_ achieve the result of doing the same thing over and over again but not in a declarative way.

Ansible is the most obvious tool to point at here. An ansible run is idempotent but it achieves idempotency using a series of imperative steps.

You might be wondering "why are you confusing things by saying declarative = idempotent". The reason is because very often, idempotent and declarative are linked very close. You can be idempotent without being declarative, but it's a whole lot harder (and rarer) than it is without a DAG behind the scenes.

## I think I get it. Why do people think Pulumi and CDK are imperative then?

As I mentioned earlier, I believe the confusion lies in the authoring experience. Configuration languages make declarative states easy to grasp, because you can't use conditionals in configuration languages without bolting on a templating language or making big changes to a DSL.

With Pulumi and AWS CDK however, you can use conditionals to your hearts content because they use imperative languages as their primary authoring experience.

Take the following snippet of Pulumi code as an example:

```typescript
const isMinikube = config.require("isMinikube");

// Allocate an IP to the nginx Deployment.
const frontend = new k8s.core.v1.Service(appName, {
    metadata: { labels: nginx.spec.template.metadata.labels },
    spec: {
        type: isMinikube === "true" ? "ClusterIP" : "LoadBalancer", // imperative code!
        ports: [{ port: 80, targetPort: 80, protocol: "TCP" }],
        selector: appLabels,
    },
});
```

Here, you can see we've defined a boolean condition `isMinikube` and then we're making decisions for how we construct the resources using a [ternary operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator).

There is no way for me to argue that this is a imperative operation, because it is. If you're thinking; "You've made a circular argument here Lee, how very un-DAG like of you" then let me tell you this..

While this operation is imperative, the result is still declarative. All this imperative code block is doing is affecting **how the declarative graph is built**

## An imperative graph

When you define conditionals in AWS CDK, Terraform CDK, Pulumi or any other infrastructure as code tool that might see the light and realise imperative languages are just superior to configuration languages, you are still building a DAG. What the imperative authoring experience is giving you is the ability to manipulate how the DAG is built.

Terraform HCL has these same imperative mechanisms, it just has less of them. It has the [`count`](https://www.terraform.io/language/meta-arguments/count) meta argument which is abused as a conditional _constantly_ in Terraform modules. It has the `for_each` meta argument which again, allows you to manipulate the graph that is built.

Imperative languages just give you the flexbility you actually bloody need to manipulate the way the graph is built.

If you're _still_ not convinced at this point, and are going to die on the hill of "configuration languages are the only true way to be declarative" then allow me to introduce you to [Pulumi YAML](https://www.pulumi.com/blog/pulumi-yaml/)

```yaml
name: webserver
runtime: yaml
description: Basic example of an AWS web server accessible over HTTP
configuration:
  InstanceType:
    type: String
    default: t3.micro
variables:
  ec2ami:
    Fn::Invoke:
      Function: aws:getAmi
      Arguments:
        filters:
          - name: name
            values: ["amzn-ami-hvm-*-x86_64-ebs"]
        owners: ["137112412989"]
        mostRecent: true
      Return: id
resources:
  WebSecGrp:
    type: aws:ec2:SecurityGroup
    properties:
      ingress:
        - protocol: tcp
          fromPort: 80
          toPort: 80
          cidrBlocks: ["0.0.0.0/0"]
  WebServer:
    type: aws:ec2:Instance
    properties:
      instanceType: ${InstanceType}
      ami: ${ec2ami}
      userData: |-
          #!/bin/bash
          echo 'Hello, World from ${WebSecGrp.arn}!' > index.html
          nohup python -m SimpleHTTPServer 80 &
      vpcSecurityGroupIds:
        - ${WebSecGrp}
  UsEast2Provider:
    type: pulumi:providers:aws
    properties:
      region: us-east-2
  MyBucket:
    type: aws:s3:Bucket
    options:
      provider: ${UsEast2Provider}
outputs:
  InstanceId: ${WebServer.id}
  PublicIp: ${WebServer.publicIp}
  PublicHostName: ${WebServer.publicDns}
```

There you go. It's declarative now. I hope you're happy.