---
title: Understanding Pulumi's apply 
layout: post
category: blog
tags:
- async
- pulumi
- getting-started
---

If you've never written in-depth, production ready software in your programming language of choice,  you might never have come across asynchronous programming. I managed to spend several years as an infrastructure type person and hadn't ever really written any tool or software that took advantage of asynchronous concepts. This created a learning curve for me when trying out Pulumi, and meant I had to bend my mind around some new concepts when I started working at Pulumi.

Pulumi uses asynchronous mechanisms in each of its languages in order to ensure it can process data correctly. This can often confuses new users, and leads to the question we see most in our community:

> How do I get the value of this Output and use it as a string?

So this blog post has a single aim: to detail my personal understanding of how Pulumi uses these asynchronous values and hopefully, help you - the reader, get to a better understanding too.

# What is an Output?

Before we talk about the asynchronous part of Pulumi, let's first talk about what an `Output` is.

You may have heard the term "Output" already in your Pulumi journey. Pulumi has a [detailed page](https://www.pulumi.com/docs/intro/concepts/inputs-outputs/) explaining what an Output is, but for the sake of being thorough, I'd like to detail it here in my own terms.

## EC2 (Eventually Consistent Compute?)

Let's take a single EC2 instance as an example.

When you create an EC2 instance, you define it using some properties. Values like the instance size and the AMI you want to use are decided by you. In Pulumi parlance, we call these `Inputs` - more on these later.

When you create the instance itself, whether it's with the API or via the console, the AWS API will populate with properties that define what this instance looks like. The canonical example of this is the Instance ID (which itself is a [resource ID](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/resource-ids.html)). If you've ever created an EC2 instance before, you'll know that you can _only_ get this value once the instance has been created. Some other examples of values that are only known after the instance creation are:

  - The [ARN](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html) of the instance
  - The instance state (as defined by the [instance lifecycle](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html))
  - The ID of the primary network interface attached to the instance.

The fact that these values are not known until after the resource has been presents a challenge for Pulumi programs, which are generally written in imperative programming languages. What if you want to use this value somewhere in your program, but the actual resource itself hasn't yet finished provisioning? How do you handle the `nil` or empty values?

Pulumi handles these cases by assigning the values of these API responses a special value type. In Pulumi, we call this an `Output<T>`

## What the fuck is that `<T>` all about?

A quick aside here, for those not familiar with what `<T>` is.

`<T>` is a mechanism for denoting that the value is known at some point in the future. It comes from [Generic Programming](https://en.wikipedia.org/wiki/Generic_programming) and is really useful in situations like this, when we (ie, us running our Pulumi programs) are waiting for the value to be returned from our cloud providers API.

If you again take the EC2 instance ID as an example value, it generally looks like this:

`i-6dhfbb736`

Which of course, in pretty much any sane programming language is a `string`. However, because this value is only known when we get it back from the AWS API, we can't just tell the Pulumi program it's a `string`, because the value isn't known at runtime, so instead, we instead say it's type is: `Output<string>`.

# Back to Inputs

Okay, so now we've spent some time talking about `Outputs`, let's go back to our resource, an EC2 instance.

As we mentioned earlier, every Pulumi resource has properties you can define. For our EC2 resource, we already decided that some of these values are things like the AMI we want to use, and the instance type. 

In Pulumi's SDK, these properties will accept a certain _type_. As an example, you cannot pass an `integer` to an the `AMI` property.

What's interesting about these properties is that they'll allow a type `Input<string>` which essentially means you can pass a standard string *or* an `Output<string>`. 

If you pass a standard string, Pulumi will happily create that resource with the value you specify, but if you pass an `Output<string>` (ie, the value from another resource that gets populated when the resource is created) - Pulumi will figure out the relationship between those two resources and _create them in order_.

This is the magic secret sauce that allows you to use imperative programming language to declarative create infrastructure, and is also a text book example of asynchronous programming. It is essentially: "Wait for this value, then do something with it".

# Okay I get it, tell me how to get the string value

This has been a lengthy explanation of all the different parts of how Pulumi's type system works, but if you're reading this because you want to understand how to use a string with an `Output` you're probably thinking "just give me the recipe". So let's get to it.

Using our instance as an example, one thing you might want to specify for your instance is [user data](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html).

User data as a property on the instance, does _not_ accept an `Input<string>`. It will ONLY allow you to specify a standard string. This presents a challenge for Pulumi, because - what if you want to put the value of another resource into that user data?

Other common resource patterns where this comes up in AWS is specifying IAM policy data. IAM roles and policies only accept JSON strings as valid inputs, but it's very common to want to pass the value of other resources into IAM policies.

So how do we handle this in Pulumi? We use `apply()`.

## `apply()` me a river

The best way I can think of to describe what `apply()` does in Pulumi is this:

"Wait for the value you're applying to be known, then do something"

Let's look at some code. I'm going to define two resources, an S3 bucket, and than our trust EC2 instance. All I want to do here is interpolate the ARN of the S3 bucket into the EC2 Instances user data.

```typescript
// define a bucket
const bucket = new aws.s3.Bucket("test")

const instance = new aws.ec2.Instance("test", {
    instanceType: "t2.micro",
    ami: "ami-a0cfeed8",
    keyName: "lbriggs",
    associatePublicIpAddress: true,
    userData: bucket.arn.apply(arn => `#!/bin/bash\n echo ${arn} >> /tmp/bucket-arn`)
})
```

To break this down a little bit, you'll see I'm selecting one of the `Output` values from the S3 bucket (in this case the `arn`) and then I'm adding the `apply()` to the end of it. In simpler terms, I'm saying "once the value of `arn` is populated, run everything inside the `()`.

You can pretty much anything you want inside the `apply()` at this point, because once you're inside the `apply()` - the value of the raw string value is now available to you natively as a `string`. Pulumi will handle all the asynchronous logic for you. 

## Getting cute with `apply()`

The fact that `apply()` waits for values to be populated means you can do some pretty interesting things with it. One example of this is waiting for resources to be created and then passing it to other programs, which is especially useful when you're using Pulumi's incredible [automation api](https://www.pulumi.com/automation/). Here's an example of passing a function to the `apply()` call in Python, and then writing the value to a local file, which could then be picked up by another program, or even another application:

```python
# define a new loadbalancer
lb = aws.lb.LoadBalancer(
    "lbriggs-lb",
    subnets=default_vpc_subnets.ids,
)

# define a function to write an arn to a file
def write_to_file(arn):
    f = open("arn.txt", "a")
    f.write(arn)
    f.close()

json = lb.arn.apply(lambda a: write_to_file(arn=a))
```

Pulumi's resource model allows you to be extremely flexible with the `apply()` callback, as long as you understand a little bit more about why it's needed.

## Wrap up

There's a lot more to write about the eventual nature of Pulumi programming. You might want to take a look at how you can use `apply()` on multiple values using [`Output.all()`](https://www.pulumi.com/docs/intro/concepts/inputs-outputs/#all) or even make things a little simpler in those easier cases using [interpolate](https://www.pulumi.com/docs/intro/concepts/inputs-outputs/#outputs-and-strings). Hopefully this helps with gaining understanding of _why_ you can't just use those properties in the way you expect, and helps you a little bit on your Pulumi journey.












