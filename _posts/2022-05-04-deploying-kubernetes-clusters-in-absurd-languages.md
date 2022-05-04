---
title: Deploying Kubernetes clusters in increasingly absurd languages
layout: post
category: blog
tags:
- infrastructure-as-code
- infrastructure-as-software
- pulumi
- yaml
---

It's been over 3 years since I published my most successful blog post about the abject horror of [templated yaml]({% post_url 2019-02-07-why-are-we-templating-yaml %}) and in many ways, I feel the same way now as I did then, with the exception of falling out of love with jsonnet. Jsonnet seemed like a good tool for the job when I was using Go templates to try and get results, but in 2022 there are lots of different mechanisms you can use to avoid YAML templating hell.

Today, we at [Pulumi](https://pulumi.com) announced [YAML support](https://www.pulumi.com/blog/pulumi-yaml/). You might be wondering, "Lee, don't you fucking hate YAML? Isn't that your whole thing?"

Well, hell has frozen over and Pulumi supports YAML now. So instead of bemoaning this fact, why don't be lean into this and see what kind of miserable experience we can create for ourselves?

## Pulumi's YAML compiler

When YAML support was added, enterprising [CUE](https://cuelang.org/) fan, friend and colleague [David Flanagan](https://twitter.com/rawkode) used the Pulumi hackathon to add a mechanism to automatically convert CUE manifests into YAML documents and pipe them directly into the Pulumi CLI. This ability to use exported CUE was initially added directly to the YAML language plugin, but project lead [Aaron Friel](https://twitter.com/aaronfriel) took David's inspiration and added the capability to use any "compiler" that spits out YAML. It looks a bit like this:

```yaml
name: my-yaml-program
runtime:
  name: yaml
  options:
    compiler: # absolutely anything that emits yaml to stdout
description: A YAML example
```

Now, I'm sure Aaron's intent was positive, but this gave me an idea: just how much can we abuse this?

## JSON and the YAMLnauts

It's worth remembering that YAML is a superset of JSON, so any valid JSON is also valid YAML. With that firmly tucked into my mind, I set about seeing what I could do with this new YAML input mechanism.

{% include note.html content="The asciicasts following only show the preview stage, because AWS doesn't value you time and takes 10ish minutes to provision an EKS cluster. I did run each example and they work, unfortunately." %}

## HCL

{% include note.html content="The code for the HCL example can be found [here](https://github.com/jaxxstorm/pulumi-examples/tree/main/hcl/aws/eks)" %}

My first thought was that HCL was an obvious candidate to author Pulumi programs, after all, it's already used to deploy infrastructure. I started with `brew install hcl2json` to get the [hcl2json](https://github.com/tmccombs/hcl2json) tool and came up with this:

```hcl
resources = {
  cluster = {
    type = "eks:Cluster"
    properties = {
      vpcId = "${vpcId}"
      subnetIds = "${subnetIds}"
      instanceType = "t2.medium"
      desiredCapacity = 2
      minSize = 1
      maxSize = 2
    }
  }
}

variables = {
  subnetIds = {
    "Fn::Invoke" = {
      Arguments = {
        vpcId = "${vpcId}"
      }
      Function = "aws:ec2:getSubnetIds"
      Return = "ids"
    }
  }
  vpcId = {
    "Fn::Invoke" = {
      Arguments = {
        default = true
      }
      Function = "aws:ec2:getVpc"
      Return = "id"
    }
  }
}

outputs = {
  kubeconfig = "${cluster.kubeconfig}"
}
```

I initially ran into a problem with my first pass because [HCL objects and blocks are remarkably similar](https://hcl.readthedocs.io/en/latest/language_design.html#blocks-vs-object-values) so my initial attempt at provisioning my EKS cluster wasn't working. I asked Aaron for some help, he joined the zoom and immediately said "oh god" which I considered to be a good sign. After ironing out the syntax issues with some help from Aaron, I defined my `Pulumi.yaml` to use `hcl2json` as a converter:

```yaml
name: hcl
runtime:
  name: yaml
  options:
    compiler: hcl2json Pulumi.hcl
description: HCL Example
```

and then deployed the very first Pulumi program authored in HCL. Behold.

[![asciicast](https://asciinema.org/a/aL05joUl4efjfSAuG97fBla9i.svg)](https://asciinema.org/a/aL05joUl4efjfSAuG97fBla9i)

Obviously, my colleagues were extremely complimentary:

![HCL](/img/hcl.png)

## Perl

{% include note.html content="The code for the Perl example can be found [here](https://github.com/jaxxstorm/pulumi-examples/tree/main/perl/aws/eks)" %}

In the midst of this conversation, my good friend and colleague [Paul Stack](https://twitter.com/stack72) said something that got my interest:

![Paul](/img/perl-stack.png)

Never a person to shy away from a bad idea, I set about installing my first CPAN module in about 12 years:

```bash
cpan YAML
```

I've written a lot of perl over the years, but it was 15 or so years ago. I couldn't even remember what the Perl data structure for an object was (it's a hash, in case you're wondering). I created a perl hash and dumped it to stdout:

```perl
use YAML 'Dump';

my @pulumi = {
    variables => {
        vpcId => {
            "Fn::Invoke" => {
                Function => "aws:ec2:getVpc",
                Arguments => {
                    default => true
                },
                Return => "id"
            }
        },
        subnetIds => {
            "Fn::Invoke" => {
                Function => "aws:ec2:getSubnetIds",
                Arguments => {
                    vpcId => "\${vpcId}"
                },
                Return => "ids"
            }
        }
    },
    resources => {
        cluster => {
            type => "eks:Cluster",
            properties => {
                vpcId => "\${vpcId}",
                subnetIds => "\${subnetIds}",
                instanceType => "t2.medium",
                desiredCapacity => 2,
                minSize => 1,
                maxSize => 2,
            }
        }
    },
    outputs => {
        kubeconfig => "\${cluster.kubeconfig}"
    }
};

print Dump( @pulumi );
```

This actually didn't feel too bad.   Hardly the most idiomatic Perl, but I'm not here to play code golf (yet). I actually felt like the perl syntax was conducive to this kind of thing. I needed to let Pulumi know what I'd written, so I went ahead and defined my `Pulumi.yaml` with the perl interpreter:

```yaml
name: perl
runtime:
  name: yaml
  options:
    compiler: perl Pulumi.pl
description: WHY HAVE YOU DONE THIS
```

And deployed the very first Pulumi program and (maybe?) the first ever Kubernetes cluster with Perl:

[![asciicast](https://asciinema.org/a/wd1dktdQk13RJpzIeBhOgHXMQ.svg)](https://asciinema.org/a/wd1dktdQk13RJpzIeBhOgHXMQ)

I was feeling pretty good here. Perl is almost as old as me. I was bringing the language into the cloud native era! 

Then I had a thought.

Just how far back in time can I go?

## Fortran

{% include note.html content="The code for the Fortran example can be found [here](https://github.com/jaxxstorm/pulumi-examples/tree/main/fortran/aws/eks)" %}

Look, I knew this was a bad idea. I had never written a line of fortran in my life. Fortran was released in 1958, a full 42 years before YAML even existed. I initially thought I might have to manually generate YAML strings which would have been as horrendous as templating YAML. Then I discovered that Fortan is actually seeing something of a renaissance! Modern Fortran is actually _growing_ in popularity according to the [TIOBE Index](https://www.tiobe.com/tiobe-index/).

So I searched for "Fortran JSON" and was greeted with a [GitHub repo](https://github.com/jacobwilliams/json-fortran)

> JSON-Fortran: A Modern Fortran JSON API

Perhaps this was going to be easier than I thought?

I installed the JSON fortran library via _homebrew_

```bash
brew install json-fortran
```

I struggled to figure out how to [reference the damn thing](https://github.com/jacobwilliams/json-fortran/issues/514).

Then I ran the [example](https://github.com/jacobwilliams/json-fortran/wiki/Example-Usage) program and saw some JSON appear on my screen.

I then went and poured myself a very large glass of whisky and wrote the following:

```fortran
program pulumi

   use,intrinsic :: iso_fortran_env, only: wp => real64
   use json_module

   implicit none

   type(json_core) :: json
   type(json_value),pointer :: p, inp
   type(json_value), pointer :: resources, cluster, properties
   type(json_value), pointer :: variables, vpcId, subnetIds
   type(json_value), pointer :: vpcInvoke, vpcInvokeArguments
   type(json_value), pointer :: subnetInvoke, subnetInvokeArguments

   ! initialize the class
   call json%initialize()

   ! initialize the structure:
   call json%create_object(p,'')

   ! create root object
   call json%create_object(inp,'inputs')
   call json%add(p, inp) !add it to the root

   ! create the variables object
   call json%create_object(variables, 'variables')
   call json%add(inp, variables)

   ! create the vpc variable object
   call json%create_object(vpcId, 'vpcId')
   call json%add(variables, vpcId)
   call json%create_object(vpcInvoke, 'Fn::Invoke')
   call json%add(vpcId, vpcInvoke)
   call json%add(vpcInvoke, 'Function', 'aws:ec2:getVpc')
   call json%create_object(vpcInvokeArguments, 'Arguments')
   call json%add(vpcInvoke, vpcInvokeArguments)
   call json%add(vpcInvokeArguments, 'default', 'true')
   call json%add(vpcInvoke, 'Return', 'id')

   ! create the subnet ids variable object
   call json%create_object(subnetIds, 'subnetIds')
   call json%add(variables, subnetIds)
   call json%create_object(subnetInvoke, 'Fn::Invoke')
   call json%add(subnetIds, subnetInvoke)
   call json%add(subnetInvoke, 'Function', 'aws:ec2:getSubnetIds')
   call json%create_object(subnetInvokeArguments, 'Arguments')
   call json%add(subnetInvoke, subnetInvokeArguments)
   call json%add(subnetInvokeArguments, 'vpcId', '${vpcId}')
   call json%add(subnetInvoke, 'Return', 'ids')

   ! create the resources object
   call json%create_object(resources, 'resources')
   call json%add(inp, resources) ! add to root object

   ! create the cluster object
   call json%create_object(cluster, 'cluster')
   call json%add(resources, cluster) ! add cluster to resources
   call json%add(cluster, 'type', 'eks:Cluster') ! set the resource type

   ! create the resource properties object
   call json%create_object(properties, 'properties')
   call json%add(cluster, properties)
   call json%add(properties, 'vpcId', '${vpcId}')
   call json%add(properties, 'subnetIds', '${subnetIds}')
   call json%add(properties, 'instanceType', 't2.medium')
   call json%add(properties, 'desiredCapacity', 2)
   call json%add(properties, 'minSize', 1)
   call json%add(properties, 'maxSize', 2)

   ! write the file:
   call json%print(inp)

end program pulumi
```

Is it pretty? Well, no. Is it useful? No, it's really not. Isn't it _interesting_? Well, I certainly think it is, considering Fortran is older than my Dad. I considered for a moment than I was probably doing something no other idiot has ever done. Then I figured out that I had to _compile_ this Fortran so that Pulumi could render the JSON.

I threw together a little script that would compile the program and then clean it up afterwards:

```bash
#!/bin/bash

tmpdir=$(mktemp -d)
gfortran pulumi.f90 -o ${tmpdir}/pulumi -I $(brew --prefix)/Cellar/json-fortran/8.2.5/include/ $(brew --prefix)/Cellar/json-fortran/8.2.5/lib/libjsonfortran.a
${tmpdir}/pulumi

trap 'rm -rf -- "${tmpdir}"' EXIT
```

And then I created a `Pulumi.yaml` to actually provision a fucking Kubernetes cluster with _FORTRAN_:

```yaml
name: fortran
runtime:
  name: yaml
  options:
    compiler: ./run.sh
description: Fortran Example
```

And ran it:

[![asciicast](https://asciinema.org/a/vEHRcFZOz7sDU6rRc62sovg0N.svg)](https://asciinema.org/a/vEHRcFZOz7sDU6rRc62sovg0N)

And then then I wept. [Not because I had no worlds left to conquer](https://www.theparisreview.org/blog/2020/03/19/and-alexander-wept/) (although that does feel true, if you can provision something in Fortran, is anything else impressive?) but because I had just wasted several hours doing something extremely useless.

## Takeaways

I've written this article in a very tongue in cheek manner, but I do think there's something to take away from this journey. Pulumi often gets issues filed asking for support in a myriad of different languages, and ultimately, we're not going to be able to support them all. A primary difficulty with adding languages isn't adding support for the language itself (via the language host) but the heavy lifting required in order to write code generated SDKs that make sense in that language.

Pulumi's YAML support is billed as "universal" infrastructure as code, and I think if you can take anything away from this post (other than me needing to find a hobby) is that with the introduction of YAML as a target language, we truly support any language you'd like to use. Simply have that language emit JSON or YAML, and you can provision infrastructure in any language you like.

Which really begs the question: just how absurd can we get? There are many more people out there more talented at software development than me, so if you come up with a Pulumi program that generates valid Pulumi YAML in a language, send a pull request to my [pulumi examples](https://github.com/jaxxstorm/pulumi-examples) and I'll be happy to show the world how absurd this can get.
