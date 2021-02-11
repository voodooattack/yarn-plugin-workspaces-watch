# yarn-plugin-workspaces-watch
Watches package.json files for changes and installs the project dependencies automatically.  

## Installation:
```
$ yarn set version berry
$ yarn plugin import https://raw.githubusercontent.com/voodooattack/yarn-plugin-workspaces-watch/master/bundles/%40yarnpkg/plugin-workspaces-watch.js
```

### Description:
Watch for changes in all workspaces. Installing, updating, and removing packages on demand

### Usage:

`$ yarn workspaces watch`

### Options:

|Argument|Description|
|-----|-----|
| `--json` |            Format the output as an NDJSON stream |
| `--inline-builds`  |  Verbosely print the output of the build steps of dependencies |
| `--skip-builds`   |    Skip the build step altogether |
| `--exec #0`  |         Command to execute on on changes |
| `--pid-file #0`  |    PID file to use |

### Details:

This command is similar to `yarn install`, but it doesn't exit and keeps
watching for any changes to package.json files, updating project dependencies as
necessary.

### Examples:

Watch all workspaces:

`$ yarn workspaces watch`

Run a command after every update in the affect workspace's directory:

`$ yarn workspaces watch --exec "echo Hello world!"`

### License (MIT)

>Copyright 2021, Abdullah Ali
>
>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
