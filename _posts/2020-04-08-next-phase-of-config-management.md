---
title: The next phase of configuration management
layout: post
category: blog
tags:
- pulumi
- kubernetes
- AWS
---


{% include note.html content="An advanced warning: I recently changed companies and now work for [Pulumi](https://pulumi.com), which I'll be discussing here. If you don't want to hear about that, look away now." %}

## Configuration complexity chases you

This year marks my 10th anniversary as a (full time) system administrator. When I look back over that journey, remembering my first role for a large bank as a Lotus Notes administrator to now, I can safely say that one part of the job has been frustrating for me and has been ever-present in every role I've taken on. It's something that has followed me throughout every interpretation of "system administration" (and the job role has had many names, which is a thread I don't want to pull at). It's something that has I've seen declared "solved" multiple times by different tools and products, but always manages to evolve as the industry changes.

Configuration complexity.

When I started my career, the problem of the day was the configuration of operating systems. Workloads were beginning to scale beyond the scope of single machines, and we needed a set of solutions to ensure all those machines _looked_ the way we wanted them to. Tooling like Puppet, Chef, and then Ansible became incredibly popular very quickly because they were declarative. You defined your desired state in code (or something like code, which I'll get to in a moment), and the tool took care of converging on that state. This pattern worked, and we all got a lot better at managing massive numbers of machines.
At this point, someone at Amazon realised that companies were spending thousands of person-hours wasting their time doing stupid things like managing servers and buying hard drives. AWS changed the way we managed our systems, and the tooling we had adapted to suit those systems. When AWS was starting to gain momentum, it was still a widespread practice to boot your EC2 instance and configure the operating system on it.
Unfortunately, this introduced another layer of complexity. Your cloud provider's API layer now needs configuration, and we had all gotten used to the idea we wanted to declare our state and have something converge on it. The existing tools in this space weren't cutting it, and then all of a sudden, Terraform emerged out of Hashicorp to solve _most_ of our problems.

## DSLs: A necessary evil

The most successful tools of this era had something in common, even if they differed in the way they solved the problem. I attribute the success of the two tools I've used the most until this point (Puppet and Terraform) to the fact that they both have very readable and powerful DSLs. The decision to use DSLs made them extremely approachable to people, even with rudimentary software engineering backgrounds. Generally, you can take a simple block of Puppet code and very quickly get an idea of what it's going to do:

```puppet
  file { '/tmp/my-file':
    ensure  => present,
    content => 'foo',
    user    => 'jaxxstorm',
  }
```

HCL has a similar approach - its simplicity allows you to look at (basic) HCL and get a decent idea of what's going to happen when you execute it. Here's a similar operation as our Puppet example in HCL:

```hcl
resource "local_file" "my-file" {
    content     = "foo"
    filename = "/tmp/my-file",
}
```

Simplicity is fantastic when you get started. However, in my experience with DSLs over the past 10 years is that you will, unfortunately, reach a tipping point in which you're going to look at what you've created in horror. 
Ultimately, there's a universal truth of configuration complexity. No matter how you approach it, you're dealing with 2 distinct users:
People who want to twiddle all the different knobs, so they want all the configuration options available to them.
People who only want the defaults, and might make a few changes later.  
Catering to both those users with a DSL is _hard_. Both of the tools I'm most familiar with, Puppet and Terraform tried to approach this using a concept of "modules." At their core, the idea is reasonable - abstract away the configuration complexity into a set of sane defaults, and expose the knobs for people to twiddle as parameters to the module. Unfortunately, this - in my admittedly humble opinion, hasn't solved the problem. 

To get an idea of where we are here, let's take a look at the [terraform-eks module](https://github.com/terraform-aws-modules/terraform-aws-eks). In particular, take a look at the [workers_launch_template.tf file](https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/workers_launch_template.tf).

You'll probably notice it's over 450 lines of HCL. I find it very difficult to understand what this file is doing at first glance. Launch templates are incredibly complex mechanisms in AWS, with lots of different options depending on your needs. Supporting all of these different cases for both of the users mentioned above in a terraform module is _creating new configuration complexity_. The terraform-eks module has so many possible inputs I genuinely couldn't be bothered to go through and count them all. In addition to this, if I want to make a configuration change to the module that for a parameter that doesn't exist, my options are:
Fork the module
Don't use the module, and write everything from scratch again.

## Okay, we get it, what's the answer?

Recently I changed companies, and this problem was consistently in my mind when deciding on what to do next. I've written before about the [need for configuration management for Kubernetes](https://leebriggs.co.uk/blog/2018/05/08/kubernetes-config-mgmt.html) clusters, however as time has gone on, I've realised what we need is configuration management for _any_ abstraction layer. I even helped in trying to solve this problem at my former employer with Kr8.
Ultimately, I believe that the only way to solve this configuration complexity is with language that is expressive and flexible. I've concluded that DSLs will only ever get you part of the way there.
The only solution currently on the market is something I excitedly wrote about in September 2018 - [Pulumi](https://www.pulumi.com/).
Pulumi allows you to take control of your configuration in your choice of programming language. With the decision to use a fully-featured language instead of a DSL, a whole world of opportunity opens up. 

Pulumi provides you direct access to the configuration options you might be familiar with in Terraform (in fact, you can convert terraform _providers_ to Pulumi providers in a relatively straightforward manner). However, by providing access to these resources using a programming language, you can be extremely creative in how they get used.

### Pulumi x libraries

Examples of how this flexibility looks like in practice can be when you take a look at the [awsx library](https://github.com/pulumi/pulumi-awsx), which is maintained by the Pulumi team.

This library uses the standard [aws library](https://github.com/pulumi/pulumi-aws) under the hood, but wraps it up in sane configuration defaults using standard packaging methods. I previously wrote a very [ranty and frustrated post](https://leebriggs.co.uk/blog/2019/04/13/the-fargate-illusion.html) about how hard it was to stand up a service on fargate using terraform. Here's what it looks like in awsx (using typescript):

```typescript
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const listener = new awsx.lb.NetworkListener("nginx", { port: 80 });
const nginx = new awsx.ecs.FargateService("nginx", {
    taskDefinitionArgs: {
        containers: {
            nginx: {
                image: "nginx",
                memory: 128,
                portMappings: [listener],
            },
        },
    },
    desiredCount: 2,
});
```

Seeing code like this makes sense to me. If I want simple, off the shelf defaults, I can write a module/library, but if I want to get into the nuts and bolts of the configuration, I can use the `@pulumi/aws` library and talk to the API directly. 

### What's next?

I joined Pulumi at the end of March, and I'm incredibly excited about being on the frontlines of battling configuration complexity. Going forward, I expect this blog to contain updates (sporadically, of course) about my journey. Already in my short time at Pulumi, I've dived into new programming languages (I wrote my first ever dotnet code this week!), heard from users, and been more involved than ever before in an open-source community. Most importantly, I can see a time where I don't have to write a single line of YAML!