# Art of README

> Source: [hackergrrl/art-of-readme](https://github.com/hackergrrl/art-of-readme)

*This article can also be read in [Chinese](README-zh.md),
[Japanese](README-ja-JP.md),
[Brazilian Portuguese](README-pt-BR.md), [Spanish](README-es-ES.md),
[German](README-de-DE.md), [French](README-fr.md) and [Traditional Chinese](README-zh-TW.md).*

## Etymology

Where does the term "README" come from?

The nomenclature dates back to *at least* the 1970s [and the
PDP-10](http://pdp-10.trailing-edge.com/decuslib10-04/01/43,50322/read.me.html),
though it may even harken back to the days of informative paper notes placed atop
stacks of punchcards, "READ ME!" scrawled on them, describing their use.

A reader<sup>[1](#footnote-1)</sup> suggested that the title README may be a playful nudge toward Lewis
Carroll's *Alice's Adventures in Wonderland*, which features a potion and a cake
labelled *"DRINK ME"* and *"EAT ME"*, respectively.

The pattern of README appearing in all-caps is a consistent facet throughout
history. In addition to the visual strikingness of using all-caps, UNIX systems
would sort capitals before lower case letters, conveniently putting the README
before the rest of the directory's content<sup>[2](#footnote-2)</sup>.

The intent is clear: *"This is important information for the user to read before
proceeding."* Let's explore together what constitutes "important information" in
this modern age.


## For creators, for consumers

This is an article about READMEs. About what they do, why they are an absolute
necessity, and how to craft them well.

This is written for module creators, for as a builder of modules, your job is to
create something that will last. This is an inherent motivation, even if the
author has no intent of sharing their work. Once 6 months pass, a module without
documentation begins to look new and unfamiliar.

This is also written for module consumers, for every module author is also a
module consumer. Node has a very healthy degree of interdependency: no one lives
at the bottom of the dependency tree.

Despite being focused on Node, the author contends that its lessons apply
equally well to other programming ecosystems, as well.


## Many modules: some good, some bad

The Node ecosystem is powered by its modules. [npm](https://npmjs.org) is the
magic that makes it all *go*. In the course of a week, Node developers evaluate
dozens of modules for inclusion in their projects. This is a great deal of power
being churned out on a daily basis, ripe for the plucking, just as fast as one
can write `npm install`.

Like any ecosystem that is extremely accessible, the quality bar varies. npm
does its best to nicely pack away all of these modules and ship them far and
wide. However, the tools found are widely varied: some are shining and new,
others broken and rusty, and still others are somewhere in between. There are
even some that we don't know what they do!

For modules, this can take the form of inaccurate or unhelpful names (any
guesses what the `fudge` module does?), no documentation, no tests, no source
code comments, or incomprehensible function names.

Many don't have an active maintainer. If a module has no human available to
answer questions and explain what a module does, combined with no remnants of
documentation left behind, a module becomes a bizarre alien artifact, unusable
and incomprehensible by the archaeologist-hackers of tomorrow.

For those modules that do have documentation, where do they fall on the quality
spectrum? Maybe it's just a one-liner description: `"sorts numbers by their hex
value"`. Maybe it's a snippet of example code. These are both improvements upon
nothing, but they tend to result in the worst-case scenario for a modern day
module spelunker: digging into the source code to try and understand how it
actually works. Writing excellent documentation is all about keeping the users
*out* of the source code by providing instructions sufficient to enjoy the
wonderful abstractions that your module brings.

Node has a "wide" ecosystem: it's largely made up of a very long list of
independent do-one-thing-well modules flying no flags but their own. There are
[exceptions](https://github.com/lodash/lodash), but despite these minor fiefdoms,
it is the single-purpose commoners who, given their larger numbers, truly rule the
Node kingdom.

This situation has a natural consequence: it can be hard to find *quality* modules
that do exactly what you want.

**This is okay**. Truly. A low bar to entry and a discoverability problem is
infinitely better than a culture problem, where only the privileged few may
participate.

Plus, discoverability -- as it turns out -- is easier to address.


## All roads lead to README.md

The Node community has responded to the challenge of discoverability in
different ways.

Some experienced Node developers band together to create [curated
lists](https://github.com/sindresorhus/awesome-nodejs) of quality modules.
Developers leverage their many years examining hundreds of different modules to
share with newcomers the *crème de la crème*: the best modules in each category.
This might also take the form of RSS feeds and mailing lists of new modules deemed
to be useful by trusted community members.

How about the social graph? This idea spurred the creation of
[node-modules.com](http://node-modules.com/), a npm search replacement that
leverages your GitHub social graph to find modules your friends like or have
made.

Of course there is also npm's built-in [search](https://npmjs.org)
functionality: a safe default, and the usual port of entry for new developers.

No matter your approach, regardless whether a module spelunker enters the module
underground at [npmjs.org](https://npmjs.org),
[github.com](https://github.com), or somewhere else, this would-be user will
eventually end up staring your README square in the face. Since your users
will inevitably find themselves here, what can be done to make their first
impressions maximally effective?


## Professional module spelunking

### The README: Your one-stop shop

A README is a module consumer's first -- and maybe only -- look into your
creation. The consumer wants a module to fulfill their need, so you must explain
exactly what need your module fills, and how effectively it does so.

Your job is to

1. tell them what it is (with context)
2. show them what it looks like in action
3. show them how they use it
4. tell them any other relevant details

This is *your* job. It's up to the module creator to prove that their work is a
shining gem in the sea of slipshod modules. Since so many developers' eyes will
find their way to your README before anything else, quality here is your
public-facing measure of your work.


### Brevity

The lack of a README is a powerful red flag, but even a lengthy README is not
indicative of there being high quality. The ideal README is as short as it can
be without being any shorter. Detailed documentation is good -- make separate
pages for it! -- but keep your README succinct.


### Learn from the past

It is said that those who do not study their history are doomed to make its
mistakes again. Developers have been writing documentation for quite some number
of years. It would be wasteful to not look back a little bit and see what people
did right before Node.

Perl, for all of the flak it receives, is in some ways the spiritual grandparent
of Node. Both are high-level scripting languages, adopt many UNIX idioms, fuel
much of the internet, and both feature a wide module ecosystem.

It so turns out that the [monks](http://perlmonks.org) of the Perl community
indeed have a great deal of experience in writing [quality
READMEs](http://search.cpan.org/~kane/Archive-Tar/lib/Archive/Tar.pm). CPAN is a
wonderful resource that is worth reading through to learn more about a community
that wrote consistently high-calibre documentation.


### No README? No abstraction

No README means developers will need to delve into your code in order to
understand it.

The Perl monks have wisdom to share on the matter:

> Your documentation is complete when someone can use your module without ever
> having to look at its code. This is very important. This makes it possible for
> you to separate your module's documented interface from its internal
> implementation (guts). This is good because it means that you are free to
> change the module's internals as long as the interface remains the same.
>
> Remember: the documentation, not the code, defines what a module does.
-- [Ken Williams](http://mathforum.org/ken/perl_modules.html#document)


### Key elements

Once a README is located, the brave module spelunker must scan it to discern if
it matches the developer's needs. This becomes essentially a series of pattern
matching problems for their brain to solve, where each step takes them deeper
into the module and its details.

Let's say, for example, my search for a 2D collision detection module leads me
to [`collide-2d-aabb-aabb`](https://github.com/hackergrrl/collide-2d-aabb-aabb). I
begin to examine it from top to bottom:

1. *Name* -- self-explanatory names are best. `collide-2d-aabb-aabb` sounds
   promising, though it assumes I know what an "aabb" is. If the name sounds too
   vague or unrelated, it may be a signal to move on.

2. *One-liner* -- having a one-liner that describes the module is useful for
   getting an idea of what the module does in slightly greater detail.
   `collide-2d-aabb-aabb` says it

   > Determines whether a moving axis-aligned bounding box (AABB) collides with
   > other AABBs.

   Awesome: it defines what an AABB is, and what the module does. Now to gauge how
   well it'd fit into my code:

3. *Usage* -- rather than starting to delve into the API docs, it'd be great to
   see what the module looks like in action. I can quickly determine whether the
   example JS fits the desired style and problem. People have lots of opinions
   on things like promises/callbacks and ES6. If it does fit the bill, then I
   can proceed to greater detail.

4. *API* -- the name, description, and usage of this module all sound appealing
   to me. I'm very likely to use this module at this point. I just need to scan
   the API to make sure it does exactly what I need and that it will integrate
   easily into my codebase. The API section ought to detail the module's objects
   and functions, their signatures, return types, callbacks, and events in
   detail. Types should be included where they aren't obvious. Caveats should be
   made clear.

5. *Installation* -- if I've read this far down, then I'm sold on trying out the
   module. If there are nonstandard installation notes, here's where they'd go,
   but even if it's just a regular `npm install`, I'd like to see that mentioned,
   too. New users start using Node all the time, so having a link to npmjs.org
   and an install command provides them the resources to figure out how Node
   modules work.

6. *License* -- most modules put this at the very bottom, but this might
   actually be better to have higher up; you're likely to exclude a module VERY
   quickly if it has a license incompatible with your work. I generally stick to
   the MIT/BSD/X11/ISC flavours. If you have a non-permissive license, stick it
   at the very top of the module to prevent any confusion.


## Cognitive funneling

The ordering of the above was not chosen at random.

Module consumers use many modules, and need to look at many modules.

Once you've looked at hundreds of modules, you begin to notice that the mind
benefits from predictable patterns.

You also start to build out your own personal heuristic for what information you
want, and what red flags disqualify modules quickly.

Thus, it follows that in a README it is desirable to have:

1. a predictable format
2. certain key elements present

You don't need to use *this* format, but try to be consistent to save your users
precious cognitive cycles.

The ordering presented here is lovingly referred to as "cognitive funneling,"
and can be imagined as a funnel held upright, where the widest end contains the
broadest more pertinent details, and moving deeper down into the funnel presents
more specific details that are pertinent for only a reader who is interested
enough in your work to have reached that deeply in the document. Finally, the
bottom can be reserved for details only for those intrigued by the deeper
context of the work (background, credits, biblio, etc.).

Once again, the Perl monks have wisdom to share on the subject:

> The level of detail in Perl module documentation generally goes from
> less detailed to more detailed.  Your SYNOPSIS section should
> contain a minimal example of use (perhaps as little as one line of
> code; skip the unusual use cases or anything not needed by most
> users); the DESCRIPTION should describe your module in broad terms,
> generally in just a few paragraphs; more detail of the module's
> routines or methods, lengthy code examples, or other in-depth
> material should be given in subsequent sections.
>
> Ideally, someone who's slightly familiar with your module should be
> able to refresh their memory without hitting "page down".  As your
> reader continues through the document, they should receive a
> progressively greater amount of knowledge.
> -- from `perlmodstyle`


## Care about people's time

Awesome; the ordering of these key elements should be decided by how quickly
they let someone 'short circuit' and bail on your module.

This sounds bleak, doesn't it? But think about it: your job, when you're doing
it with optimal altruism in mind, isn't to "sell" people on your work. It's to
let them evaluate what your creation does as objectively as possible, and decide
whether it meets their needs or not -- not to, say, maximize your downloads or
userbase.

This mindset doesn't appeal to everyone; it requires checking your ego at the
door and letting the work speak for itself as much as possible. Your only job is
to describe its promise as succinctly as you can, so module spelunkers can
either use your work when it's a fit, or move on to something else that does.


## Call to arms!

Go forth, brave module spelunker, and make your work discoverable and usable
through excellent documentation!


## Bonus: other good practices

Outside of the key points of the article, there are other practices you can
follow (or not follow) to raise your README's quality bar even further and
maximize its usefulness to others:

1. Consider including a **Background** section if your module depends on
   important but not widely known abstractions or other ecosystems. The function
   of [`bisecting-between`](https://github.com/hackergrrl/bisecting-between) is not
   immediately obvious from its name, so it has a detailed *Background* section
   to define and link to the big concepts and abstractions one needs to
   understand to use and grok it. This is also a great place to explain the
   module's motivation if similar modules already exist on npm.

2. Aggressively linkify! If you talk about other modules, ideas, or people, make
   that reference text a link so that visitors can more easily grok your module
   and the ideas it builds on. Few modules exist in a vacuum: all work comes
   from other work, so it pays to help users follow your module's history and
   inspiration.

3. Include information on types of arguments and return parameters if it's not
   obvious. Prefer convention wherever possible (`cb` probably means callback
   function, `num` probably means a `Number`, etc.).

4. Include the example code in **Usage** as a file in your repo -- maybe as
   `example.js`. It's great to have README code that users can actually run if
   they clone the repository.

5. Be judicious in your use of badges. They're easy to
   [abuse](https://github.com/angular/angular). They can also be a breeding
   ground for bikeshedding and endless debate. They add visual noise to your
   README and generally only function if the user is reading your Markdown in a
   browser online, since the images are often hosted elsewhere on the
   internet. For each badge, consider: "what real value is this badge providing
   to the typical viewer of this README?" Do you have a CI badge to show build/test
   status? This signal would better reach important parties by emailing
   maintainers or automatically creating an issue. Always consider the
   audience of the data in your README and ask yourself if there's a flow for
   that data that can better reach its intended audience.

6. API formatting is highly bikesheddable. Use whatever format you think is
   clearest, but make sure your format expresses important subtleties:

   a. which parameters are optional, and their defaults

   b. type information, where it is not obvious from convention

   c. for `opts` object parameters, all keys and values that are accepted

   d. don't shy away from providing a tiny example of an API function's use if
      it is not obvious or fully covered in the **Usage** section.
      However, this can also be a strong signal that the function is too complex
      and needs to be refactored, broken into smaller functions, or removed
      altogether

   e. aggressively linkify specialized terminology! In markdown you can keep
      [footnotes](https://daringfireball.net/projects/markdown/syntax#link) at
      the bottom of your document, so referring to them several times throughout
      becomes cheap. Some of my personal preferences on API formatting can be
      found
      [here](https://github.com/hackergrrl/common-readme/blob/master/api_formatting.md)

7. If your module is a small collection of stateless functions, having a
   **Usage** section as a [Node REPL
   session](https://github.com/hackergrrl/bisecting-between#example) of function
   calls and results might communicate usage more clearly than a source code
   file to run.

8. If your module provides a CLI (command line interface) instead of (or in
    addition to) a programmatic API, show usage examples as command invocations
    and their output. If you create or modify a file, `cat` it to demonstrate
    the change before and after.

9. Don't forget to use `package.json`
    [keywords](https://docs.npmjs.com/files/package.json#keywords) to direct
    module spelunkers to your doorstep.

10. The more you change your API, the more work you need to exert updating
    documentation -- the implication here is that you should keep your APIs
    small and concretely defined early on. Requirements change over time, but
    instead of front-loading assumptions into the APIs of your modules, load
    them up one level of abstraction: the module set itself. If the requirements
    *do* change and 'do-one-concrete-thing' no longer makes sense, then simply
    write a new module that does the thing you need. The 'do-one-concrete-thing'
    module remains a valid and valuable model for the npm ecosystem, and your
    course correction cost you nothing but a simple substitution of one module for
    another.

11. Finally, please remember that your version control repository and its
    embedded README will outlive your [repository host](https://github.com) and
    any of the things you hyperlink to -- especially images -- so *inline* anything
    that is essential to future users grokking your work.


## Bonus: *common-readme*

Not coincidentally, this is also the format used by
[**common-readme**](https://github.com/hackergrrl/common-readme), a set of README
guidelines and handy command-line generator. If you like what's written here,
you may save some time writing READMEs with `common-readme`. You'll find
real module examples with this format, too.

You may also enjoy
[standard-readme](https://github.com/richardlitt/standard-readme), which is a
more structured, lintable take on a common README format.


## Bonus: Exemplars

Theory is well and good, but what do excellent READMEs look like? Here are some
that I think embody the principles of this article well:

- https://github.com/hackergrrl/ice-box
- https://github.com/substack/quote-stream
- https://github.com/feross/bittorrent-dht
- https://github.com/mikolalysenko/box-intersect
- https://github.com/freeman-lab/pixel-grid
- https://github.com/mafintosh/torrent-stream
- https://github.com/pull-stream/pull-stream
- https://github.com/substack/tape
- https://github.com/yoshuawuyts/vmd


## Bonus: The README Checklist

A helpful checklist to gauge how your README is coming along:

- [ ] One-liner explaining the purpose of the module
- [ ] Necessary background context & links
- [ ] Potentially unfamiliar terms link to informative sources
- [ ] Clear, *runnable* example of usage
- [ ] Installation instructions
- [ ] Extensive API documentation
- [ ] Performs [cognitive funneling](https://github.com/hackergrrl/art-of-readme#cognitive-funneling)
- [ ] Caveats and limitations mentioned up-front
- [ ] Doesn't rely on images to relay critical information
- [ ] License


## The author

Hi, I'm [Kira](http://kira.solar).

This little project began back in May in Berlin at squatconf, where I was
digging into how Perl monks write their documentation and also lamenting the
state of READMEs in the Node ecosystem. It spurred me to create
[common-readme](https://github.com/hackergrrl/common-readme). The "README Tips"
section overflowed with tips though, which I decided could be usefully collected
into an article about writing READMEs. Thus, Art of README was born!


## Further Reading

- [README-Driven Development](http://tom.preston-werner.com/2010/08/23/readme-driven-development.html)
- [Documentation First](http://joeyh.name/blog/entry/documentation_first/)


## Footnotes

1. <a name="footnote-1"></a>Thanks,
   [Sixes666](https://www.reddit.com/r/node/comments/55eto9/nodejs_the_art_of_readme/d8akpz6)!

2. <a name="footnote-2"></a>See [The Jargon File](http://catb.org/~esr/jargon/html/R/README-file.html).
   However, most systems today will not sort capitals before all lowercase
   characters, reducing this convention's usefulness to just the visual
   strikingness of all-caps.


## Credits

A heartfelt thank you to [@mafintosh](https://github.com/mafintosh) and
[@feross](https://github.com/feross) for the encouragement I needed to get this
idea off the ground and start writing!

Thank you to the following awesome readers for noticing errors and sending me
PRs :heart: :

- [@ungoldman](https://github.com/ungoldman)
- [@boidolr](https://github.com/boidolr)
- [@imjoehaines](https://github.com/imjoehaines)
- [@radarhere](https://github.com/radarhere)
- [@joshmanders](https://github.com/joshmanders)
- [@ddbeck](https://github.com/ddbeck)
- [@RichardLitt](https://github.com/RichardLitt)
- [@StevenMaude](https://github.com/StevenMaude)
- [@KrishMunot](https://github.com/KrishMunot)
- [@chesterhow](https://github.com/chesterhow)
- [@sjsyrek](https://github.com/sjsyrek)
- [@thenickcox](https://github.com/thenickcox)

Thank you to [@qihaiyan](https://github.com/qihaiyan) for translating Art of
README to Chinese! The following users also made contributions:

- [@BrettDong](https://github.com/brettdong) for revising punctuation in Chinese version.
- [@Alex-fun](https://github.com/Alex-fun)
- [@HmyBmny](https://github.com/HmyBmny)
- [@vra](https://github.com/vra)

Thank you to [@lennonjesus](https://github.com/lennonjesus) for translating Art
of README to Brazilian Portuguese! The following users also made contributions:

- [@rectius](https://github.com/rectius)

Thank you to [@jabiinfante](https://github.com/jabiinfante) for translating Art
of README to Spanish!

Thank you to [@Ryuno-Ki](https://github.com/Ryuno-Ki) for translating Art of
README to German! The following users also made contributions:

- [@randomC0der](https://github.com/randomC0der)

Thank you to [@Manfred Madelaine](https://github.com/Manfred-Madelaine-pro) and
[@Ruben Madelaine](https://github.com/Ruben-Madelaine)
for translating Art of README to French!

## Other Resources
Some readers have suggested other useful resources for README composition:
- [Software Release Practice](https://tldp.org/HOWTO/Software-Release-Practice-HOWTO/distpractice.html#readme)
- [GNU Releases](https://www.gnu.org/prep/standards/html_node/Releases.html#index-README-file)


## License

[Creative Commons Attribution License](http://creativecommons.org/licenses/by/2.0/)
