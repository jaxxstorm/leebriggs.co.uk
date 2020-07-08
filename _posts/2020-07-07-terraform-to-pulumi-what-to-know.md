---
title: Pulumi to Terraform - What you need to know
layout: post
category: blog
tags:
- pulumi
- terraform
- cloud
---

If you've used Terraform before, migrating to Pulumi is often an exhilarating experience. Since I started working at Pulumi back in March, I've heard countless stories from users about how adopting Pulumi has changed the way their organizations work and allowed them to be more expressive and productive with their cloud infrastructure.

When switching between similar software products, it's often an instinctive reaction to try and reach for familiar concepts from the thing you know. One of the most common types of questions I've answered in the Pulumi community slack is "In Terraform, I can do X. How do I do that in Pulumi?"

So, in this post, I'd like to try and detail a few concepts I've learned and mapped them back to Terraform concepts. If you're picking up Pulumi for the first time, this is a great place to start - let's take a look! 

# Managing State

The very first thing you'll come across when you fire up Pulumi is that state management gets handled differently. In Terraform, you set up your state inside a provider block within your code, like so:

{% highlight hcl %}
terraform {
  backend "s3" {
    bucket = "state-bucket"
    key    = "/repo"
    region = "us-west-2"
  }
}
{% endhighlight %}

Every time this is changed, you need to run `terraform init` before running `terraform apply`. 
Depending on how you organize your terraform code, you need to provide this configuration for each repo you're managing. You might choose to use different state buckets or use different keys within that state.

Pulumi handles this very differently. You manage the state using the `pulumi login` command.

By default, pulumi will log you into its SaaS managed backend (which is free for individual use). To use an object store/bucket, you login by providing the bucket name prefixed with the type of bucket, like so:

{% highlight bash %}
# AWS S3
pulumi login s3://my-state-bucket
# Azure Blob Storage
pulumi login azblob://my-state-bucket
# GCloud Cloud Storage
pulumi login gcs://my-state-bucket
{% endhighlight %}

You can read more information on how to use this [here](https://www.pulumi.com/docs/intro/concepts/state/#self-managed-backend).

Managing state this way has quite a few implications on how you might organize your code (which I'll get to shortly) but mainly means you no longer need to worry about specifying the keys when things up. When you initialize a project and a stack (don't worry, I'll discuss stacks shortly!), pulumi will automatically create a path in the bucket for the project, and each stack will have a unique path.

My personal opinion is that this dramatically reduces the complexity when managing the state. Still, for those familiar with Terraform's way of handling this, it might be a departure from the norm, so it's worth knowing.

You may be asking yourself at this point "should I use the same state for all my environments?". The answer to that depends on your security posture and your chosen backend. As an example, you probably don't want the same state bucket for your prodiction and development workflows because you might want to give less access to production than development. 

With the SaaS backend, you can [define permissions](https://www.pulumi.com/docs/intro/console/collaboration/stack-permissions/) easily in your organization use the console. If you're using the cloud storage backends, you might want to consider using different state for each environment. To do that, you need to make sure you login to the correct backend before running pulumi up:

{% highlight bash %}
# set the AWS creds you want to use with AWS profiles
export AWS_PROFILE=production
# Login to the dev backend
pulumi login s3://pulumi-prod-state
# run pulumi
pulumi up --stack vpc.production
{% endhighlight %}

## A quick note on sensitive data

Terraform is [very explicit](https://www.terraform.io/docs/state/sensitive-data.html) about how important the state file is and the security considerations around values like passwords in the state file: 

> For resources such as databases, this may contain initial passwords

With Terraform, you need to be very careful with values like passwords and providing access to state files. Pulumi doesn't have this problem, as it supports encrypting sensitive values in the state with keys from your cloud provider or using a password/unique key. You can read more about this [here](https://www.pulumi.com/docs/intro/concepts/config/#secrets) and [here](https://www.pulumi.com/blog/peace-of-mind-with-cloud-secret-providers/)

# Stacks & Projects

Stacks are a unique feature to Pulumi that might seem familiar if you've ever used [Terraform Workspaces](https://www.terraform.io/docs/state/workspaces.html)

Stacks are incredibly flexible and powerful and create lots of excellent scenarios around making Pulumi programs configurable and reusable. Using them is very easy, you create a stack when you initialize a new pulumi project:

```bash
pulumi new typescript
This command will walk you through creating a new Pulumi project.

Enter a value or leave blank to accept the (default), and press <ENTER>.
Press ^C at any time to quit.

project name: (test-project) my-first-project
Sorry, 'my-first-project' is not a valid project name. A project with this name already exists.
project name: (test-project) test-project
project description: (A minimal TypeScript Pulumi program) A project for Pulumi
Created project 'test-project'

Please enter your desired stack name.
To create a stack in an organization, use the format <org-name>/<stack-name> (e.g. `acmecorp/dev`).
stack name: (dev) dev
```
Once you've done this, you'll find a Pulumi.<stack-name>.yaml file in your directory which can contain things like per stack configuration values.

You can create stacks very easily by using the `stack init` command:

```
 pulumi stack init production
Created stack 'production'
```

This stack init process adds a new YAML file which can be updated. You can switch between them or remove them if necessary.

Stacks work regardless of your chosen backend, but depending on which backend you're using, you might want to consider how you name things. With the Pulumi SaaS  you can specify your stack name using the slash, for example, `my-company/test-stack` The part before the slash is an organizational namespace, and within the SaaS it'll places the stack in the right place and permissions will be applied (note: organization support is a paid feature!)

If you're using a cloud backend, you'll need to take an additional step. Naming your stack, you'll want to set the project name and the environment or region somehow. A commonly developed pattern is to use periods or dashes in the stack name. For example, if we have a project that manages our VPCs, we might do this for two different stacks:

```
pulumi stack init vpc.production
pulumi stack init vpc.development
```
## A quick note about locking
Terraform locking is supported differently depending on which backend you're using. With Pulumi, locking is not currently supported for Cloud Backends. You can achieve methods of locking by wrapping the Pulumi CLI with a wrapper script, and [some users](https://twitter.com/JakeGinnivan/status/1278521541504888832) are doing just this. If you're using the Pulumi SaaS backend, it handles locking for you.

## Modules & Component Resources

Creating reusable code in Terraform often involves creating a module. Modules can be nested (for example, it's often the case [that a public module will have more modules within it](https://github.com/terraform-aws-modules/terraform-aws-eks/tree/master/modules/node_groups)) and they take inputs and define outputs (more on that later).

Modules are an implementation detail of Terraform that allows you to define groups of resources that live together. For example, if you want to create an EKS cluster in AWS, you'll need a create a bunch of worker nodes and the control plane, which are distinct resources. Modules allow you to define these together, and make them configurable via inputs.

Pulumi, however, doesn't have a module system of its own. Pulumi's use of standard programming languages (rather than HCL) mean you can leverage the package manager for your language of choice (e.g. NPM, NuGet, Pip or Go Modules) to share code. 

Pulumi uses [Component Resources](https://www.pulumi.com/docs/intro/concepts/programming-model/#resources) to group resources together and allows you to define and register resources in Pulumi with their unique name. This method of group resources is an _incredibly_ powerful tool. Depending on your chosen programming language, the way you specify inputs varies, and outputs are handled slightly different (more on that in a second).

There are some great ComponentResource examples available, but my favourite is [this one](https://github.com/jen20/pulumi-aws-vpc) written by James Nugent that defines a VPC that adheres to AWS best practices. It's available for NodeJS and Python and is a great example of the powerful ways you can reuse code with Pulumi.

# Outputs & Stack References

With Terraform, if you need to pass data between different projects or modules, you'd define an output:

{% highlight hcl %}
output "instance_ip_addr" {
  value = aws_instance.server.private_ip
}
{% endhighlight %}

The "output" then gets stored in the terraform state in a way that makes it accessible either when a module reads the state or when the module is instantiated within your terraform code.

With Pulumi, you just need to export the resource or parameter, which varies depending on the programming languages. As an example, you might create a VPC and export it in typescript like so:

{% highlight typescript %}
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("my-bucket");

// Export the name of the bucket
export const bucketName = bucket.id;
{% endhighlight %}

Here, we export the bucket id from the created bucket, which makes it available across stacks. You can then use a [Stack Reference](https://www.pulumi.com/docs/intro/concepts/organizing-stacks-projects/#inter-stack-dependencies) to use it elsewhere.

In addition to this, it's common to have different states for different components in Terraform,  you might also need to use the [remote state data source](https://www.terraform.io/docs/providers/terraform/d/remote_state.html) to reference outputs in other terraform states:

{% highlight hcl %}
data "terraform_remote_state" "vpc" {
  count   = (var.vpc_id == "" && var.vpc_id == "") ? 1 : 0
  backend = "s3"
  config = {
    bucket = "${var.tfstate_global_bucket}"
    key    = "${var.aws_region}/${var.vpc_name}/vpc/terraform.tfstate"
    region = "${var.tfstate_global_bucket_region}"
  }
}
{% endhighlight %}

In Pulumi, this isn't supported because it's very rarely needed. I'm hoping to write a more detailed post on this soon.

# Organizing your Code

Terraform's method of managing backends, workspaces and the implementation of modules can often mean that very quickly, your terraform code might begin to get out of control. Some interesting solutions have materialized for this, like [Terragrunt](https://github.com/gruntwork-io/terragrunt) and [Astro](https://github.com/uber/astro) and if you're familiar with them, you might wonder how to approach this with Pulumi.

Pulumi has a [page dedicated](https://www.pulumi.com/docs/intro/concepts/organizing-stacks-projects/) to this very question, but I'd like to add a bit of personal opinion to this.

## Blast radius & rate of change

Because of how powerful pulumi is, you might be tempted to create a monolithic repository with all your logic in a single stack/project. As an example of this, with Pulumi it's very easy to write a program that creates a VPC, Subnets, a Kubernetes cluster and installs several applications on that cluster. You can create a very useful piece of automation here, which allows users of your program to quickly deploy their entire stack.
Generally, this isn't considered a good idea. The VPC in your infrastructure is unlikely to be changing at the same rate as the applications in your EKS cluster, and you don't want to be in a situation whereby you can accidentally nuke all your infrastructure with a bad command.

Generally, before I start writing some code, I start by considering the rate of change of a project, and what the impact of making a mistake in it would be. 

### A quick example

If you look at a simple hierarchy of some infrastructure I recently provisioned with Pulumi, it looks like this:

```bash
tree -L 1
├── README.md
├── alb
├── ecs-cluster
├── grafana
└── vpc
```

To break this down a little:
- the ALB project is shared between multiple applications. It exports the listeners and the name of the load balancer as an output, which can then be used as a stack reference later
- the ECS cluster project defines a component resource which bootstraps an ECS cluster with an autoscaling group, a launch template, autoscaling policies, cloudwatch log groups etc. This is completely reusable, and could easily be packaged as an NPM packages (It's on my todo list, honest!)
- the grafana project defines an ECS task definition, an ECS service, an IAM role etc. to run as and a database for grafana to connect to. You can see here, the important project decision that's being made is grouping things together (similarly to Terraform modules, but not quite the same!) so that you can destroy and iterate as needed. In order to use the ALB and ECS cluster we created in the other projects, stackreferences are used:
- the VPC project defines a VPC, subnets and other lower-level components live here
I could (and hopefully will!) write a whole blog post on this, but essentially what I'm trying to get across is that you shouldn't just bundle all your code into a single project unless you're really happy about the implications. Use [Stack References](https://www.pulumi.com/docs/intro/concepts/organizing-stacks-projects/#inter-stack-dependencies) liberally where you can, and separate things into projects that make sense.

If you follow this approach, whether you use a mono-repo or a git repository for each project is entirely up to you. [This page](https://www.pulumi.com/docs/intro/concepts/organizing-stacks-projects/#organizing-projects-and-stacks) talks more about the trade-offs, but the choice is yours.

# Wrap up

There are other aspects of picking up Pulumi which might catch you out, and I may write a second post along the way, but hopefully, this will give you a nice idea of how to continue down your Pulumi journey. If you're interested in Pulumi and want to give it a try, reach out to me via twitter! Regardless of the technology you choose, enjoy building your infrastructure!
