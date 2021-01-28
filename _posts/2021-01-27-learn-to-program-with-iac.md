---
title: Learn to Code with Infrastructure as Code
layout: post
category: blog
tags:
- tech
- pulumi
- getting-started
---

While doing my usual mid-morning Twitter shill exercise for my employer last week, a twitter user slid into my replies and asked me an interesting question:

![Tweet](/img/learn-to-program-tweet.png)

This immediately struck a chord for me, because if I look back 5 years in my career, I would have considered myself a "non-programming sysadmin". Thinking about this further, I now have the title "Staff Software Engineer" on LinkedIn (which must mean it's true, right?) and yet, if another software engineer asked me if I _was_ a software engineer I'd tell them I have no idea what a mutex is and that Go interfaces still confuse me.

Despite all of my attempts to avoid it, I now write code for a living. Not only that, but I commit the cardinal software engineer sin of constantly switching languages during my day to day. Pulumi supports 4 programming language ecosystems, so at any given moment I could be writing Pulumi code in the hellscape that is Python before switching to the [soothing embrace of VB.NET]({% post_url 2020-12-16-vb-net-cloud %}).

Does the fact I can now put "programming language polyglot" on my resume mean I'm a talented software engineer? No.

I would however fancy my chances in any trivia game titled "how the hell do I configure this AWS service again?" and what _I_ believe makes Pulumi so unique as a prospect is that it allows me, a system administrator that's been given admin credentials to far too many AWS accounts, the ability to learn how to write code in many languages by reducing the number of variables in play at any one time.

## A Theory of Tech Learning

Before I wax lyrical about the wonderful company I work at, I'd first like to talk a little bit about my personal theory of learning in the tech world. Imagine you were teaching technology to the _least_ tech savvy person you know in the whole world. In fact, imagine your lovely household pet scared the fuck out of you one day and started talking, and for some reason instead of saying "you really should give me more treats", they instead say - "Can you show me how to code something?"

Let's try imagine what that conversation would look like:

>  Cat: I want to write some code  
>  You: Okay, well first you'll need an IDE  
>  Cat: What's an IDE?  
>  You: It's a thing you use to write code in, it makes your life easier. Then you'll need to pick a language  
>  Cat: Which ones would you recommend for cats to get started in?  
>  You: Well Python has snakes, but lots of people use JavaScript and it has a low barrier to entry. Java is also popular  
>  Cat: Okay, well what next?  
>  You: Well then you'll need somewhere to put your code. It's probably best to sign up for a GitHub account  
>  Cat: What's GitHub  
>  You: Oh man, well you see...  

The point I'm trying to make in this contrived unfunny example is that the number of _things_ you have to learn at any one time can be completely overwhelming. A person starting out in software development has to pick a language, learn what Git is, get their machine setup and figure out what the hell they're doing with their life, and that's before they've written a single line of code.

As an industry, it's my belief we need to do better here, but before I go off on a tangent, let me drive towards my point.

**Learning gets easier with less variables**

This isn't a new concept, it's basically [Contextualized learning](https://www.cord.org/cord_ctl_overview.php) and it's being introduced in classrooms to further improve the learning mechanisms in all countries that invest in their education system.

## So what about Pulumi?

When people ask me what's so great about [Pulumi](https://www.pulumi.com/), my first answer is always that they pay me to write blog posts. My _second_ answer is that it's accessible to anyone in your organization who wants to deliver infrastructure to the cloud. I would say 5 times out of 10, I'll get some variation of the following answer:

> My colleagues are all in on <insert inferior product here> and I just can't see them learning Python/TypeScript/other supported language

My problem with this is that people _assume_ that a Pulumi program is going to be just like the applications they support on a day to day basis, a full suite of software that has nested classes and object orientation (what's a method again?) and it's very quickly going to grow into an unmaintainable mess. What needs to be remembered is that the unmaintable mess they're creating is inside a context that person already _knows_. The code they're writing doesn't disappear into a gRPC connection or into 8000 thousand nested divs in a web page, it manifests itself as actual infrastructure that you know and understand.

Pulumi is a very powerful tool. You can absolutely write Pulumi programs like a seasoned software engineer (take our awsx package as a wonderful example), but if you're an infrastructure focused person who wants to get something done, you're almost certainly going to start relatively small and build your knowledge as you go along.

Let's take a simple example of deploying something "easy", like an Amazon EKS cluster. Here's how it looks in Pulumi, with TypeScript:


```typescript
// Create the EKS cluster itself and a deployment of the Kubernetes dashboard.
const cluster = new eks.Cluster("cluster", {
    vpcId: vpc.id,
    subnetIds: vpc.publicSubnetIds,
    instanceType: "t2.medium",
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 2,
});
```

I'm not going to tell you what you should or shouldn't find easy, but looking at this example should make you feel like you can achieve pretty much anything.

Another example: what does deploying a global dynamodb table look like in Pulumi, with Python?

```python
import pulumi
import pulumi_aws as aws

my_table = aws.dynamodb.Table("my_cool_table",
    attributes=[aws.dynamodb.TableAttributeArgs(
        name="TableHashKey",
        type="S",
    )],
    billing_mode="PAY_PER_REQUEST",
    hash_key="TableHashKey",
    replicas=[
	    aws.dynamodb.TableReplicaArgs(
		    region_name="us-east-1",
	    ),
	    aws.dynamodb.TableReplicaArgs(
		    region_name="us-west-2",
	    ),
    ],
    stream_enabled=True,
    stream_view_type="NEW_AND_OLD_IMAGES")
```

Again, this example if just a Python dict with configuration options for your resource. We're creating a cloud resource using Python and starting to understand Python dictionaries for our configuration options.

## Getting off the ground

Let's say you decide I'm not [talking bollocks](https://en.wikipedia.org/wiki/Bollocks#%22Talking_bollocks%22_and_%22bollockspeak%22) here and you agree with me. "I want to learn Python with Pulumi Lee, what should I do?".

My first piece of advice is "don't learn Python, its [package management story is a tire fire](https://twitter.com/FiloSottile/status/1342868990335594496?s=20) and the first time you screw up your indentation you're going to want to quit tech and be a bitcoin day trader", but my actual real advice would be to follow these steps..

### Pick a language

Don't make the same mistake I did and get a job at Pulumi ([we are hiring though](https://www.pulumi.com/careers/), if you want one!) because they'll have you writing examples in four different languages before your laptop even arrives through the postal system. 
Pick *one* of the language SDKs [we support](https://www.pulumi.com/docs/intro/languages/) that makes some sense. Think about what languages are available and then consider where you'll be able to get help from the software developers in your network. If you work closely with a team of backend engineers who are writing their application in Go, our GO SDK would be a great starting point.

### Start small

Whatever you do, don't try and take an existing terraform module you've deployed and convert it to Pulumi code. Take a part of your infrastructure that's small, and non-critical, and deploy it using Pulumi. You can even import the resource magically! Become comfortable creating Pulumi projects in your language of choice and managing the resources you know about. A great example I like to give people new to Pulumi is to deploy some of your DR resources (you do have a disaster recovery plan....right?) using Pulumi. It's a great opportunity to replicate your infrastructure, give your finance director a heart attack and not break production at the same time.

### Keep yourself [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)

As you start to deploy more and more infrastructure, you'll begin to notice you're repeating yourself. Here's where you really start to learn programming concepts - start to abstract the code you're reusing between Pulumi projects and stacks into libraries and reusable code like classes and functions. Let's not forget here, you're still within your safe context of cloud infrastructure, but you're now dangerously close to becoming a software engineer. 

### Ask for help

The final piece of advice I have is to make sure you don't suffer alone. StackOverflow exists as group therapy for software engineers. We also have the wonderful [Pulumi Community Slack](https://slack.pulumi.com), where Pulumi employees and other Pulumi experts hang out.

## A final note

This post has been primarily focused on "Infrastructure" people, but many of the concepts ring true for the inverse. If you're a software engineer writing front end code, and cloud providers like AWS, Azure or Google Cloud scare the bejesus out of you, beginning to deploy your shiny new application to a cloud provider in the code you already know and understand can dramatically increase the context you have while you're learning things.

If anything I've said in this post rings true, and you're finally ready to take the leap and want to learn some code, join me in a [Pulumi workshop](https://pulumi.com/resources/) where I'll personally guide you through examples of getting started.
