---
title: How I learned to stop worrying and love the YAML
layout: post
category: blog
tags:
- infrastructure-as-code
- infrastructure-as-software
- pulumi
- yaml
---

Something I miss after emigrating from the UK to the USA is the using the name of a [yeast extract based spread](https://en.wikipedia.org/wiki/Category:Yeast_extract_spreads) as an adjective. To describe something as "[marmite](https://en.wikipedia.org/wiki/Marmite)" is to indicate that people either "love it" or "hate it", and if you ask anyone from the UK, Australia or New Zealand how they feel about Marmite, Vegemite or its cousins, you'll see visceral reactions on both sides of the marmite spectrum.


{% include youtube.html id='M29CYYyRnqA' %}
<br>

YAML is the "marmite" of infrastructure as code. If you ask a software engineer or DevOps practitioner what they think of YAML, they may tell you they write their entire production infrastructure in thousands of lines of YAML, or they could claw our their eyes and run screaming from the room. There doesn't seem to be much of a middle ground. If you've read this blog [before]({% post_url 2019-02-07-why-are-we-templating-yaml %}) and even as recently as [this week]({% post_url 2022-05-04-deploying-kubernetes-clusters-in-absurd-languages %}) you'll be aware I fall firmly on the "hate it" side of what I'm going to call "the marmite spectrum".

The biggest problem I have with YAML is not the language itself, but the way it's shoehorned into situations it has no reasonable right to be involved in. One of those situations is complex infrastructure as code definitions.

There are a multitude of infrastructure as code tools out there that will allow you to use YAML or other configuration formats to describe infrastructure as code, so [Pulumi adding support for YAML](https://www.pulumi.com/blog/pulumi-yaml/) as a language came as a surprise to many:

![HackerNews](/img/hacker-news-yaml.png)
<br>
![Slack](/img/slack-yaml.png)

When our CTO, Luke Hoban told us all we were adding YAML to the roadmap, I had my own doubts:

![Slack-lbriggs-YAML](/img/lbriggs-slack-yaml.png)

So why am I now writing a blog post talking about me learning to love YAML? Let's talk about it.

## Let's talk about the YAML
<br>

![YAML](/img/talk-about-the-yaml.jpg)

Pulumi has long been the refuge of people not wanting to use YAML in their infrastructure definitions. Our marketing content was focused entirely on the idea you could use "familiar" or general purpose, expressive languages to define your infrastructure. I've talked with hundreds of users who repeatedly told me that _not_ having YAML support was enlightening.

To understand why YAML is now a supported language, we first need to look at the problem we're trying to solve, and those problems invariably come from our users or _potential_ users.

The two main talking points we're faced with during the Pulumi adoption or sales cycle and in the infrastructure as code community are related to the use of general purpose languages. The first, is general purpose languages aren't _right_ for infrastructrue, the second is that general purpose languages are too complex for the problem at hand.

### The abstraction argument

The abstraction argument goes a little bit like this:

> Software developers know nothing about infrastructure, and when they write infrastructure as code in the same language they're writing their applications in they make it really complex. I then have to fix it, and thats really really hard.

Lets put aside for this post my intense frustration with the ivory tower, "I'm better than you because I understand the magical incantation of IAM roles" bullshit this is and focus more on the argument itself.

This line of thinking often continues with the idea that configuration languages are the perfect antidote to this monstrous complexity. I agree that configuration languages provide guard rails to complexity, but this entire world view ignores one truth.

**Whether we like it or not, infrastructure is complex.**

We all know one of those people who'll tell you that the answer to all infrastructure problems is a bunch of EC2 instances, a golden AMI and a load balancer. Those people might be right, but if take a look at your infrastructure right now, could you solve the problems in your organization by going back to building AMIs and sticking them behind a load balancer? Even if you can, do you really want to? No, I thought not.

If you're using a configuration language to define your infrastructure, you've no doubt already run into this. We can see this fait accompli by watching the evolution of [HCL as a language](https://github.com/hashicorp/hcl). HCL _started_ as a simple mechanism to express JSON files, and now you can define abstractions ([modules](https://www.terraform.io/language/modules/develop)), use conditionals ([sort of](https://www.terraform.io/language/expressions/conditionals), although if you want optional parts of your infrastructure, you'll need to abuse the `count` option) and [leverage loops](https://www.terraform.io/language/meta-arguments/for_each). Its further apparent in [Helm](https://helm.sh/) which uses [Go templates](https://helm.sh/docs/chart_template_guide/functions_and_pipelines/) to allow you to express the complexity that inherently exists in Kubernetes deployments.

Writing Terraform or Helm charts can leave you in a weird twilight zone where you feel like you're writing software but you're just not quite there. Don't believe me? Take a look at the [AWS Transit Gateway Module](https://github.com/terraform-aws-modules/terraform-aws-transit-gateway/blob/master/main.tf#L1-L21https://github.com/terraform-aws-modules/terraform-aws-transit-gateway/blob/master/main.tf) for Terraform. It has code like this in there:

```hcl
locals {
  # List of maps with key and route values
  vpc_attachments_with_routes = chunklist(flatten([
    for k, v in var.vpc_attachments : setproduct([{ key = k }], v.tgw_routes) if var.create_tgw && can(v.tgw_routes)
  ]), 2)

  tgw_default_route_table_tags_merged = merge(
    var.tags,
    { Name = var.name },
    var.tgw_default_route_table_tags,
  )

  vpc_route_table_destination_cidr = flatten([
    for k, v in var.vpc_attachments : [
      for rtb_id in try(v.vpc_route_table_ids, []) : {
        rtb_id = rtb_id
        cidr   = v.tgw_destination_cidr
      }
    ]
  ])
}
```

Or perhaps this [Helm chart defining](https://github.com/prometheus-community/helm-charts/blob/main/charts/prometheus/templates/node-exporter/daemonset.yaml#L41-L69) a Prometheus Node Exporter for Kubernetes is more your style:

{% highlight yaml %}{% raw %}
      containers:
        - name: {{ template "prometheus.name" . }}-{{ .Values.nodeExporter.name }}
          image: "{{ .Values.nodeExporter.image.repository }}:{{ .Values.nodeExporter.image.tag }}"
          imagePullPolicy: "{{ .Values.nodeExporter.image.pullPolicy }}"
          args:
            - --path.procfs=/host/proc
            - --path.sysfs=/host/sys
          {{- if .Values.nodeExporter.hostRootfs }}
            - --path.rootfs=/host/root
          {{- end }}
          {{- if .Values.nodeExporter.hostNetwork }}
            - --web.listen-address=:{{ .Values.nodeExporter.service.hostPort }}
          {{- end }}
          {{- range $key, $value := .Values.nodeExporter.extraArgs }}
          {{- if $value }}
            - --{{ $key }}={{ $value }}
          {{- else }}
            - --{{ $key }}
          {{- end }}
          {{- end }}
          ports:
            - name: metrics
              {{- if .Values.nodeExporter.hostNetwork }}
              containerPort: {{ .Values.nodeExporter.service.hostPort }}
              {{- else }}
              containerPort: 9100
              {{- end }}
              hostPort: {{ .Values.nodeExporter.service.hostPort }}
{% endraw %}{% endhighlight %}

You can argue (and many do) that these mechanisms are the _perfect_ balance of flexibility and control. It is my opinion that they are just bolt ons to configuration to make them closer to programming languages  to _try_ and meet users where their needs are.

### The complexity argument

I've been very open about the fact that I don't consider myself a talented software engineer. I've said before that I didn't _truly_ understand programming constructs like [Object orientation](https://en.wikipedia.org/wiki/Object-oriented_programming) until I joined Pulumi. What I mean to say here is that I _get_ this argument. 

What I don't understand about this argument is that people seem unwilling to admit that the world is fundamentally changing. It's my opinion that the people who truly loathe Pulumi don't want to admit they don't understand the languages it supports very well. They're worried that adopting Pulumi is going to put them out of a job. I could never prove this of course, but I believe it because _I also_ believed it.

Here's the truths nobody wants to admit.

**There are more "software engineers" than there are "infrastructure engineers" (or DevOps engineers, SREs, Platform Engineers, whatever you want to call them) and they need to ship their software.**

**The vast majority of those software engineers don't want to bolt templates on top of configuration languages or use a DSL they can only use for one purpose.**

So if you're an infrastructure engineer clinging on to your DSL, you might want to consider the idea you're the [Betamax](https://en.wikipedia.org/wiki/Betamax) of the tech industry. Even if you're _right_ about configuration languages being the _right_ way to define infrastructure, the entire industry is moving away from them ([AWS CDK](https://aws.amazon.com/cdk/) and [Terraform CDK](https://www.terraform.io/cdktf) and the investment in them further support this argument) and you're going to get left in the dust, complexity be damned.

## Breaking the marmite spectrum

If you've gotten this far, you might be forgiven for thinking "This is just another post about how much you hate YAML Lee", but I promise we're going somewhere.

Pulumi's additional of YAML is in _my_ mind, a great, balanced addition designed to help users with _both_ of these problems. Here's why.

### The abstraction problem

If we all agree with the idea that infrastructure is complex, it's difficult to understand how Pulumi YAML solves that problem. It's entirely possible to define a complex set of services using YAML, such as this example of running something in Azure Container Apps

```yaml
name: azure-app-service
runtime: yaml
description: Azure app services
configuration:
  sqlAdmin:
    type: String
    default: pulumi
variables:
  blobAccessToken:
    Fn::Invoke:
      Function: azure-native:storage:listStorageAccountServiceSAS
      Arguments:
        accountName: ${sa.name}
        protocols: https
        sharedAccessStartTime: '2022-01-01'
        sharedAccessExpiryTime: '2030-01-01'
        resource: c
        resourceGroupName: ${appservicegroup.name}
        permissions: r
        canonicalizedResource: /blob/${sa.name}/${container.name}
        contentType: application/json
        cacheControl: max-age=5
        contentDisposition: inline
        contentEncoding: deflate
      Return: serviceSasToken
resources:
  appservicegroup:
    type: azure-native:resources:ResourceGroup
  sa:
    type: azure-native:storage:StorageAccount
    properties:
      resourceGroupName: ${appservicegroup.name}
      kind: 'StorageV2'
      sku: { name: 'Standard_LRS' }
  appserviceplan:
    type: azure-native:web:AppServicePlan
    properties:
      resourceGroupName: ${appservicegroup.name}
      kind: App
      sku:
        name: B1
        tier: Basic
  container:
    type: azure-native:storage:BlobContainer
    properties:
      resourceGroupName: ${appservicegroup.name}
      accountName: ${sa.name}
      publicAccess: None
  blob:
    type: azure-native:storage:Blob
    properties:
      resourceGroupName: ${appservicegroup.name}
      accountName: ${sa.name}
      containerName: ${container.name}
      type: 'Block'
      source:
        Fn::FileArchive: ./www
  appInsights:
    type: azure-native:insights:Component
    properties:
      resourceGroupName: ${appservicegroup.name}
      applicationType: web
      kind: web
  sqlPassword:
    type: random:RandomPassword
    properties:
      length: 16
      special: true
  sqlServer:
    type: azure-native:sql:Server
    properties:
      resourceGroupName: ${appservicegroup.name}
      administratorLogin: ${sqlAdmin}
      administratorLoginPassword: ${sqlPassword.result}
      version: '12.0'
  db:
    type: azure-native:sql:Database
    properties:
      resourceGroupName: ${appservicegroup.name}
      serverName: ${sqlServer.name}
      sku: { name: 'S0' }

  app:
    type: azure-native:web:WebApp
    properties:
      resourceGroupName: ${appservicegroup.name}
      serverFarmId: ${appserviceplan}
      siteConfig:
        appSettings:
          - name: WEBSITE_RUN_FROM_PACKAGE
            value: https://${sa.name}.blob.core.windows.net/${container.name}/${blob.name}?${blobAccessToken}
          - name: APPINSIGHTS_INSTRUMENTATIONKEY
            value: ${appInsights.instrumentationKey}
          - name: APPLICATIONINSIGHTS_CONNECTION_STRING
            value: InstrumentationKey=${appInsights.instrumentationKey}
          - name: ApplicationInsightsAgent_EXTENSION_VERSION
            value: ~2
        connectionStrings:
          - name: db
            type: SQLAzure
            connectionString: Server= tcp:${sqlServer.name}.database.windows.net;initial catalog=${db.name};userID=${sqlAdmin};password=${sqlPassword.result};Min Pool Size=0;Max Pool Size=30;Persist Security Info=true;
outputs:
  endpoint: ${app.defaultHostName}
```

It might just be personal preference here, but I look at that thing and _shudder_. Can you imagine authoring that? Maintaining it?

Sure, its _possible_ for you to author complex infrastructure if you want, but what if you want to override the value of `ApplicationInsightsAgent_EXTENSION_VERSION` in a different Azure subscription? Pass me the bourbon and the [Jinja template documentation](https://jinja.palletsprojects.com/en/3.1.x/) folks, I'm templating me some fucking YAML.

### Multi language components
<br>

![Force](/img/use-the-yaml-luke.jpg)

If you're expressing complex reusable infrastructure, you should use a general purpose language. Just do it. You might even like it.
Pulumi allows you easily define reusable abstractions (which we call [ComponentResources](https://www.pulumi.com/docs/intro/concepts/resources/components/)) using the concepts you know in that language, but in addition to this, you can then consume that abstraction in any of Pulumi's supported languages. We call these ["multi language components"](https://www.pulumi.com/blog/pulumiup-pulumi-packages-multi-language-components/).

If you've defined a multi language component, you can consume that component with Pulumi YAML. You're not able to _author_ the component in YAML, however, if you're _consuming_ that component, using YAML to instantiate it can provide you a very simple interface. You can see an example of this in this Pulumi program using the [Pulumi Crosswalk for AWS EKS component](https://www.pulumi.com/docs/guides/crosswalk/aws/eks/):

```yaml
name: aws-eks
runtime: yaml
description: An EKS cluster
variables:
  vpcId:
    Fn::Invoke:
      Function: aws:ec2:getVpc
      Arguments:
        default: true
      Return: id
  subnetIds:
    Fn::Invoke:
      Function: aws:ec2:getSubnetIds
      Arguments:
        vpcId: ${vpcId}
      Return: ids
resources:
  cluster:
    type: eks:Cluster
    properties:
      vpcId: ${vpcId}
      subnetIds: ${subnetIds}
      instanceType: "t2.medium"
      desiredCapacity: 2
      minSize: 1
      maxSize: 2
      createOidcProvider: true
outputs:
  kubeconfig: ${cluster.kubeconfig}
```

This 30 or so lines of YAML will define an entire EKS cluster, the needed autoscaling groups to attach nodes to that cluster, an OIDC provider, security groups - everything! Don't take my word for it though, check out this asciinema recording:

[![asciicast](https://asciinema.org/a/yjXzjSw91y6mMckByhcXVeCbT.svg)](https://asciinema.org/a/yjXzjSw91y6mMckByhcXVeCbT)

Being able to define the reusable component in your language of choice gives you all of the flexibility and expressibility you need to truly provide options to your users, but also provides a simple, straightforward interface for users who just want to deploy a Kubernetes cluster without having to deal with Python VirtualEnvs or figure out why NPM is downloading half the internet.

You can see an even simpler implemenation of this with my ["productionapp"](https://github.com/jaxxstorm/pulumi-productionapp) multi language example that I use to for product demos. This example has abstracted _all_ the complexity of a Kubernetes deployment away from the end user. It can be consumed in Pulumi YAML in just 11 lines:

```yaml
name: pulumi-productionapp-yaml
runtime: yaml
description: a kubernetes production app from yaml
resources:
  app:
    type: productionapp:index:Deployment
    properties:
      image: "nginx"
      port: 80
outputs:
  url: ${app.url}
```

The logic is all encapsulated in the component itself, and the user is just left to fill out the image and the port the image runs on.

### The complexity problem

Using Pulumi with multi language packages helps with the complexity problem, and brings a simple interface to users wanting to declare complex infrastructure, but eventually, your needs might outgrow the ability to express infrastructure cleanly. You might even be halfway through defining your infrastructure and think "fuck this noise". Well, Pulumi YAML has you covered. 

### "Ejecting" from YAML

Pulumi has an _incredible_ command that will allow you to eject immediately from YAML into a general purpose language. Despite my wishes, its not called `pulumi graduate` (although you can always alias it to that) but `pulumi convert`.

Converting a Pulumi YAML program is as easy as taking your existing Pulumi YAML program and running `pulumi convert --language <insert-language-here>`

Here's how you'd "graduate" from the EKS example earlier to C#

[![asciicast](https://asciinema.org/a/kHpVN2hv5kit56hwC8kcEXM8z.svg)](https://asciinema.org/a/kHpVN2hv5kit56hwC8kcEXM8z)

If you're not finding that impressive, maybe converting the earlier ball of YAML to define an Azure App service will win you over?

[![asciicast](https://asciinema.org/a/MJolksAWeTc8O0mqtXGZJdOTt.svg)](https://asciinema.org/a/MJolksAWeTc8O0mqtXGZJdOTt)

Converting 100+ lines in TypeScript in seconds means I'm now able to start using the full power of the language, without having to go through the arduous task of converting it all. You might even learn more about the language your converting to in the process! 

## Summary

The whole point of adding YAML to Pulumi is to bridge the gap for everyone in the infrastructure as code space. You don't have to choose your authoring experience anymore, you can seamlessly switch between configuration languages and general purpose programming languages as you need. You can define best practices and abstractions and then let your downstream users _choose_ how they want to consume them. Are you a Java application engineer and want to get started with infrastructure as code? Awesome, just use Java. Have you authored millions of lines of Kubernetes manifests and want to eventually get the engineers you support to deploy their own damn workloads and leave you alone? Start with Pulumi YAML, convert it to Python and throw it over the fence to them if you want.

I shared the draft of this blog with a friend and former coworker of mine who's a data scientist and business analyst. In addition to providing valuable feedback, he also had this to say:

![YAML-Feedback](/img/yaml-feedback.png)

Adding YAML as a supported language throws the door open to people wanting to deploy their infrastructure, and the thing is _everyone_ needs to deploy infrastructure. My data scientist friend needs infrastructure for his data analysis in [R](https://www.r-project.org/) and YAML is a mechanism to enable that. If he decides that YAML no longer meets those needs, he can happily convert it to Python and head down the path to learning Python through the lense of something he already knows.

Our latest set of releases had the marketing slogan "[universal infrastructure as code](https://www.pulumi.com/blog/pulumi-universal-iac/)" and for once, I feel like the product does _even more_ than the marketing promises.











