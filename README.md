# http-load - v0.1.0

## Simple load testing tool for HTTP applications

`http-load` is a very simple load testing tool, mainly developed to try out some Node.js features. It's strongly inspired (i.e. it liberately steals ideas from) [http_load][0]. Use at your own risk, and don't expect too much. Patches/pull requests welcome, maybe this might even become useful one day.

## Installation

Right now the best way to install is probably to clone the repository and do an `npm link`, at least until I manage to put it into the official npm repo.

## Usage

Create a file containing the URI(s) you want to connect to, one URI per line. Create a directory named `./public` (hard coded right now) where there's a file containing the contents for each request, using the last path segment of the URI as the file name. Then invoke it on the command line:

    node http-load <file>
    
The reason for the files in the local directory is that `http-load` performs a hash comparison of the bytes downloaded. This is one of the things I plan to change (see Limitations below).

There are a number of options you can specify:

    -v                      turn on verbose logging
    -n [number of requests] (defaults to 100)
    --cachedir <directory>  where to store content for comparison
    -i                      (record headers when something other than 200 is returned)

## Limitations

Lots:

* It should be possible to specify the number of concurrent connections. I didn't find an obvious way to get around Node's internal Agent default; this is what I'll address next.
* Only GET request are performed right now.
* Currently, the requests need to be performed once 'by hand' so that the hash comparison can be performed. I plan to change this so that there's an optional first run (using just one request per URI) that 'initializes' the local directory.
* There are absolutely no tests at all, which should give you some indication as to the tool's reliability.
* Many more; hey, this is the result of a day's hacking in a language and framework I'm far from being an expert in.



### License

Copyright (c) 2011 Stefan Tilkov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

[0]: http://acme.com/software/http_load/
