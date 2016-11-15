---
layout: post
title: Using hiera-eyaml-gpg
category: blog
tags:
  - puppet
---

Every company that uses Puppet eventually gets to the stage in their development where they want to store "secrets" within Puppet. Usually (hopefully!) your Puppet manifests and data will be stored in version control in plaintext and therefore adding these secrets to your manifests has some clear security concerns which need to be addressed.

You _could_ just restrict the data to a few select people, and have it in a separate control repo, but at the end of the day, your secrets will still be in plaintext and you're at the mercy of your version control ACLs. 

Fortunately, a bunch of very smart people came across this problem a while ago and gave us the solutions we need to be able to solve the problem.

[hiera-eyaml](https://github.com/TomPoulton/hiera-eyaml) has been around a while now and gives you the capability to encrypt secrets stored in hiera. It provides an `eyaml` command line tool to make use of this, and will encrypt values for you using a pluggable backend. By default, it uses asymmetric encryption (PKCS#7) and will make any value indecipherable to anyone who has the key. You can see the example in the linked github repo, but for verbosity sake, it looks like this:

{% highlight yaml %}

---
plain-property: You can see me

encrypted-property: >
    ENC[PKCS7,Y22exl+OvjDe+drmik2XEeD3VQtl1uZJXFFF2NnrMXDWx0csyqLB/2NOWefv
    NBTZfOlPvMlAesyr4bUY4I5XeVbVk38XKxeriH69EFAD4CahIZlC8lkE/uDh
    jJGQfh052eonkungHIcuGKY/5sEbbZl/qufjAtp/ufor15VBJtsXt17tXP4y
    l5ZP119Fwq8xiREGOL0lVvFYJz2hZc1ppPCNG5lwuLnTekXN/OazNYpf4CMd
    /HjZFXwcXRtTlzewJLc+/gox2IfByQRhsI/AgogRfYQKocZgFb/DOZoXR7wm
    IZGeunzwhqfmEtGiqpvJJQ5wVRdzJVpTnANBA5qxeA==]

{% endhighlight %}

In order to see the encrypted-property, you need to have access to the preshared key you used to encrypt the value, which means you have to copy the pre-shared key to your master. This is fine if you're a single user managing a small number of Puppetmasters, but as your team scales this actually introduces a security consideration.

How do you pass the preshared key around? The more people that touch that key, the less secure it becomes. Distributing it to 20 odd people means that if a single user's laptop is compromised, _all_ your secrets will be under threat. Fortunately, there's a better way of managing this which is facilitated by the plugin system hiera-eyaml supports, and the solution is [hiera-eyaml-gpg](https://github.com/sihil/hiera-eyaml-gpg)

## Using GPG Keys

The problem with hiera-eyaml-gpg is that the documentation only shows you how to set up hiera-eyaml-gpg, but you then have to go off and do a bunch of reading about how GPG keys work. If you already know how GPG keys work, skip ahead, this isn't for you! If you don't, let's cover quickly how GPG keys work, and how this helps us solve the single key problem above.

### Quick Overview

In a nutshell, GPG is a hybrid public and private key encryption system. In a bullet point format:

  - Each user or entity has a public and private key pair. 
  - Public keys are used for encryption, private keys are used for decryption. Messages can be signed by encrypting a hash of the message using the sender's private key, allowing the receiver to verify the integrity of the data by using the sender's public key to decrypt the hash.
  - Private keys need to be kept secure by the owner.
  - Public keys need to be transferred reliably such that they cannot be altered, and substitute keys inserted.
  - You can encrypt data for multiple recipients, by using all of their public keys together. Any of them will be able to decrypt the data using their own private key.
  - A user can add a set of other user's public keys to their GPG public keyring. Users create a "web of trust" by validating and signing user's keys in their keyrings.

Thinking of this from a Puppet perspective:

  - Each puppetmaster (or sets of puppetmasters) will have their own public and private GPG key pair. The private keys will be kept local on the puppetmasters and should not be transferred anywhere else.
  - Each user that will be editing the secure data within puppet will also have a public and private key pair. They will keep their private key secure and private to themselves.
  - Each user will need to have all of the public keys of all puppetmasters, along with all other eyaml users, added to their own public keyring. 
  - When a new user or new puppetmaster is added or a key is changed, all users will need to update their keyrings with the new public keys. Additionally, all encrypted data in hiera will need to be re-encrypted so that the new puppetmasters and users are able to decrypt the encrypted data.
  - If a puppetmaster gets compromised, or a user leaves the company, only the key for that puppetmaster (or set of puppetmasters) needs to be removed from the keyrings and encrypted data. None of the other puppetmaster or user keys need to be updated.

As you can see, this drastically improves security of your important data stored in hiera. With that in mind, let's get started..

### Generate a GPG Key

There are plenty of docs out there to explain how to generate a GPG key for each OS. In a short form, you should do this:

{% highlight bash %}
gpg --gen-key
{% endhighlight %}

You'll get a handy menu prompt that will help you generate a key. **SET A PASSPHRASE**. Having a blank passphrase will compromise the whole web of trust for your encrypted data.

### Generate a GPG Key for your Puppetmaster

Because GPG operates on the concept of each user using different keys, you'll now need to generate a key for your Puppetmaster.

If you're lucky, you can just use the above command and have done with it. In order to be more specific, here's the way I know works to generate keys:

{% highlight bash %}
# Use a reasonable directory for gpghome
mkdir -m 0700 /etc/puppetlabs/.gpghome
chown puppet:puppet /etc/puppet/.gpghome
{% endhighlight %}

Now, the GPG we generate for the puppetmasters need some special attributes, so we'll need a custom batch config file at `/etc/puppetlabs/.gpghome/keygen.inp`. Make sure you replace `_keyname_` with something useful, like maybe `puppetmaster`

{% highlight bash %}
%echo Generating a default key
Key-Type: default
Subkey-Type: default
Name-Real: _keyname_
Expire-Date: 0
%no-ask-passphrase
%no-protection
%commit
%echo done
{% endhighlight %}

Now, generate the key:

{% highlight bash %}
sudo -u puppet gpg --homedir /etc/puppet/.gpghome --gen-key --batch /etc/puppet/.gpghome/keygen.inp
{% endhighlight %}

Now that's done, you should see a GPG key in your puppetmaster's keyring:

{% highlight bash %}
sudo -u puppet gpg --homedir /etc/puppet/.gpghome --list-keys
gpg: checking the trustdb
gpg: 3 marginal(s) needed, 1 complete(s) needed, PGP trust model
gpg: depth: 0  valid:   1  signed:   0  trust: 0-, 0q, 0n, 0m, 0f, 1u
/etc/puppet/.gpghome/pubring.gpg
--------------------------------
pub   2048R/XXXXXXXX 2016-11-14
uid                  puppetmaster
sub   2048R/XXXXXXX 2016-11-14
{% endhighlight %}

### A web of trust

GPG keys operate under the model that everyone has their own public and private key, and everyone in your team trusts each other (hopefully you trust your colleagues!). In the previous step, you generated a key, now, you need to make sure all your colleagues sign your key to verify its authenticity and confirm it's valid. In order to do this, you need to distribute your _public_ key to everyone and they need to sign it.

The way you distribute the public keys is up to you, but there are tools like [Keybase](https://keybase.io) or private keyservers available which you may choose to use. Obviously, it's not recommended to send your puppetmasters GPG key to keybase. The most important consideration here is that the public keys can't be modified in transit somehow. This means sending the GPG keys via email over the internet is probably not a fantastic idea, however sending to your colleagues via internal email probably wouldn't be so terrible.

At a very minimum, you'll need to sign the keys from your puppetmaster that you generated earlier. In order to do that, export the key in ASCII format:

{% highlight bash %}
sudo -u puppet gpg --homedir /etc/puppet/.gpghome --export -a -o /etc/puppet/.gpghome/puppetmaster.pub
{% endhighlight %}

Copy the `puppetmaster.pub` file locally so it's ready to import.

In order to sign it, copy the file locally to your machine from $distribution_method and then run this:

{% highlight bash %}
gpg --import /path/to/file.pub
{% endhighlight %}

From here, you need to verify the signature, and if you're happy, sign the key:

{% highlight bash %}

gpg --sign-key <keyname>

{% endhighlight %}

You'll need to enter your own GPG keys' passphrase in order to sign the key.

Everyone who's going to be using encrypted yaml will need to perform this step for each of the keypairs you generate. This means when a new user joins the company, you'll have to import and sign the keys that users generates. There are puppet modules which ease this process, and you can simply add a public key to a puppetmaster's keyring by using [golja-gnupg](https://github.com/n1tr0g/golja-gnupg)

## Puppet, Hiera and GPG Keys

If you've now created a web of trust, you need to make Puppet aware of the GPG keys. Firstly, you'll need to generate a GPG key for your masters. We group our masters into different tiers, dev/stg and prod, and we ensure these keys are distinctly separate. Then, make sure the key is signed by the relevant people, otherwise it's pretty much useless :)

Once your keys and gpg config are set up, you'll need to get `hiera-eyaml-gpg` working.

### Install hiera-eyaml-gpg

The installation requirements are clearly spelled out [here](https://github.com/sihil/hiera-eyaml-gpg#requirements) but for clarity's sake, I'll cover the process here. The process is basically the same for both users who'll be using eyaml to encrypt values, and puppetmasters who will be encrypting values. From an OS perspective, you'll need to make sure you have the `ruby`, `ruby-devel`, `rubygems` and `gpgme` packages installed. On CentOS, that looks like this:

{% highlight bash %}
sudo yum install ruby gpgme rubygems ruby-devel
{% endhighlight %}

Then, install the required rubygems in the relevant ruby path. If you're using the latest version of puppetserver, you'll need to install this using `puppetserver gem install`

{% highlight bash %}
sudo gem install gpgme
sudo gem install hiera-eyaml
sudo gem install hiera-eyaml-gpg
{% endhighlight %}

### The Recipients File

One of the main ways that `hiera-eyaml-gpg` differs from standard `hiera-eyaml` is the `gpg.recipients` file. This file essentially lists the GPG keys that are available to decrypt secrets with a directory in hiera. This is an incredibly powerful tool, especially if you wish to allow users to encrypt/decrypt some secrets in your environment, but not others. 

When the `eyaml` command is invoked, it will search in the current working directory for this file, and if one is not found it will go up through the directory tree until one is found. As an example, your hieradats directory might look like this:

{% highlight bash %}
├── development
│   ├── app1
│   │   └── hiera-eyaml-gpg.recipients
│   └── app2
│       └── hiera-eyaml-gpg.recipients
└── production
    ├── dc1
    │   ├── base.eyaml
    │   └── hiera-eyaml-gpg.recipients
    ├── hiera-eyaml-gpg.recipients
    └── role.eyaml
{% endhighlight %}

With this kind of layout, it's possible to allow users access to certain app credentials, datacenters or even environments, without compromising all the credentials in hiera.

The format of the hiera-eyaml-gpg.recipients file is simple, it simply lists the GPG keys that are allowed to encrypt/decrypt values:


{% highlight bash %}
puppetmaster-prod
lbriggs
a_nother_user
{% endhighlight %}

The value of this can be found in the uid field of the `gpg --list-keys` command.

### Modify hiera.yaml

The final step in the process is to make `hiera` aware of this GPG plugin. Update to `hiera.yaml` to look like this:

{% highlight yaml %}
---
:backends:
  - yaml
  - eyaml
:hierarchy:
  - "nodes/%{clientcert}"
:yaml:
  :datadir: "/etc/puppet/environments/%{environment}/hieradata"
:eyaml:
  :datadir: "/etc/puppet/environments/%{environment}/hieradata"
  :gpg_gnupghome: /etc/puppet/.gpghome
  :extension: 'eyaml'
{% endhighlight %}

At this point, puppet should use the GPG extension, assuming you installed it correctly previously

## Adding an Encrypted Parameter

At this stage, you've done the following:

 - Generated GPG keys for all the human users who will be encrypting/decrypting values
 - Generated GPG keys for the puppetmasters which will be decrypting values
 - Shared the public keys around all the above to ensure they're trusted
 - Installed the components required for Puppet to use GPG keys
 - Set up the `hiera-eyaml-gpg.recipients` file so `hiera-eyaml-gpg` knows who can read/write values.

The final step here is adding an encrypted value to hiera. When you did `gem install hiera-eyaml` you also got a handy command line tool to help with this.

In order to use it simply run the following:

{% highlight yaml %}
eyaml edit hieradata/<folder>/<file>.eyaml
{% endhighlight %}

You'll be asked to enter your GPG key password, and then you'll get dropped into an editor with something like this in the header:

{% highlight yaml %}
#| This is eyaml edit mode. This text (lines starting with #| at the top of the
#| file) will be removed when you save and exit.
#|  - To edit encrypted values, change the content of the DEC(<num>)::PKCS7[]!
#|    block (or DEC(<num>)::GPG[]!).
#|    WARNING: DO NOT change the number in the parentheses.
#|  - To add a new encrypted value copy and paste a new block from the
#|    appropriate example below. Note that:
#|     * the text to encrypt goes in the square brackets
#|     * ensure you include the exclamation mark when you copy and paste
#|     * you must not include a number when adding a new block
#|    e.g. DEC::PKCS7[]! -or- DEC::GPG[]!
{% endhighlight %}

As we noted, you're using the GPG plugin, so add your value like so:

{% highlight yaml %}
class::class::parameter: DEC::GPG[correct_horse_battery_staple]!
{% endhighlight %}

When you save the file, you can cat it again and you'll see the value is now encrypted:

{% highlight yaml %}
class::class::parameter: ENC[GPG,XXXXXXXXXXXXXXXXXXXXXXXXXXXXX=]
{% endhighlight %}

From here, you can push it to git and have it downloaded using the method you use to grab your config (I hope you're using r10k!) and the puppetmaster (assuming you set up the GPG encryption correctly!) will be able to decrypt these secret and service it to hosts.

Happy encrypting!
