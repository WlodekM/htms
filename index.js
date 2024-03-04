import express from "express"
import fs from "fs"
import JSONdb from "simple-json-db"
import vm from "vm"

const PORT = 42069
const app = express()

/**
 * @returns {Element} element
 */
function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true
        });
    });
}

const s = {
    response: null,
    request: null,
    vars: {},
    api: {
        test: 'console.log("Hi")'
    },
    app: app,
    fs: fs,
    JSONdb: JSONdb,
}

function publicPage(RequestURL, FilePath) {
    // console.log(RequestURL)
    let path = RequestURL
    let filePath = (`${FilePath}${path}`)
    // console.log(filePath)
    let isDir = !(filePath.indexOf('.') > -1)
    if (isDir) filePath += filePath.endsWith("/") ? "index.html" : "/index.html"
    // console.log(filePath, isDir)
    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath.replaceAll(".html", ".htms"))) {
            return [filePath.replaceAll(".html", ".htms"), "htms"]
        }
        if (fs.existsSync(filePath.replaceAll(".html", ".xhtml"))) {
            return [filePath.replaceAll(".html", ".xhtml"), "xhtml"]
        }
        if (fs.existsSync(filePath.replaceAll(".html", ".ss"))) {
            console.log(filePath.replaceAll(".html", ".ss"))
            return [filePath.replaceAll(".html", ".ss"), "ss"]
        }
        return []
    } else {
        const types = ["ss", "xhtml", "htms"]
        let splitPath = filePath.split(".")
        let type = splitPath[splitPath.length - 1]
        // console.log(`AA ${type}`)
        switch (type) {
            case "xhtml":
                return [filePath, "xhtml"]
                break;
            case "htms":
                return [filePath, "htms"]
                break;
            case "ss":
                return [filePath, "ss"]
                break;

            default:
                // Default to XHTML because no one would use <$-- --> in a html file
                // What could POSSIBLY go wrong?
                return [filePath, "xhtml"]
                break;
        }
    }
    // console.log(filePath)
    return [filePath]
}

function publicPageFile(FilePath) {
    // console.log(RequestURL)
    // let path = RequestURL
    let filePath = (`${FilePath}`)
    // console.log(filePath)
    let isDir = !(filePath.indexOf('.') > -1)
    if (isDir) filePath += filePath.endsWith("/") ? "index.html" : "/index.html"
    // console.log(filePath, isDir)
    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath.replaceAll(".html", ".htms"))) {
            return [filePath.replaceAll(".html", ".htms")]
        }
        if (fs.existsSync(filePath.replaceAll(".html", ".xhtml"))) {
            return [filePath.replaceAll(".html", ".xhtml"), true]
        }
        return []
    }
    return [filePath]
}

function handle404(req, res) {
    let ihdguk = publicPageFile("public/404.htms")
    // console.log(ihdguk)
    res.status(404).send(htms(req, res, ihdguk[0]))
}

function xhtml(req, res, file) {
    let template = fs.readFileSync(file)
    const dictionary = {
        "DATE": (() => {
            return new Date()
        }),
        "CURR-PATH": (() => {
            return req.path
        })
    }
    let content = String(template)
    // content = content.replaceAll("{[CONTENT]}", response)
    for (const key in dictionary) {
        if (!Object.hasOwnProperty.call(dictionary, key)) continue;
        const element = dictionary[key];
        content = content.replaceAll(`<@${key}>`, element())
    }

    // console.log(content)
    const regex = /<\$--([\s\S]*?)-->/gm;
    content = content.replace(regex, (match, group) => {
        try {
            // Evaluate the code inside <%--...--%> tags
            const result = eval(group);
            const sanitizedResult = result !== undefined ? String(result) : '';
            return sanitizedResult;
        } catch (error) {
            // If there's an error during evaluation, return the original match
            console.error(`Error evaluating code: ${group}`);
            return match;
        }
    });

    //     try {
    //         // Evaluate the code inside %{...} brackets
    //         console.log(code, match)
    //         const result = eval(code);
    //         return result !== undefined ? result : match;
    //     } catch (error) {
    //         // If there's an error during evaluation, return the original match
    //         console.error(`Error evaluating code: ${code}`);
    //         return match;
    //     }
    // });
    return content
}

function htms(req, res, file) {
    let template = fs.readFileSync(String(file))
    const dictionary = {
        "DATE": (() => {
            return new Date()
        }),
        "PATH": (() => {
            return req.path
        }),
        "URL": () => {
            return req.url
        }
    }
    let content = String(template)

    let lib = fs.readFileSync("www/standardLib.htms")

    content = content.replaceAll("<include@sLib />", lib)

    const regex = {
        include: /<include@([^>\s]+(?:\s[^>]+)*)\s*\/>/g,
        ss: /<ss>([\s\S]*?)<\/ss>/g,
        api: /<api path="(.*?)">([\s\S]*?)<\/api>/g,
        apiHelper: /<\#([\s\S]*?)>/g
    }

    content = content.replace(regex.include, (match, group) => {
        try {
            // Evaluate the code inside <!--include@--> tags
            const result = fs.readFileSync(group);
            return `<!-- HTMLS - Included code from ${group} -->\n${result}\n<!-- HTMLS - End included code -->`;
        } catch (error) {
            // If there's an error during evaluation, return the original match
            console.error(`Error including code: ${group}\nError: `, error);
            return match + `<script>console.error("Could not include ${group}", "${String(error).replaceAll("\n", "\\n")}")</script>\n<!--Inclusion error-->\n<!--${error}-->`;
        }
    });

    // content = content.replaceAll("{[CONTENT]}", response)
    for (const key in dictionary) {
        if (!Object.hasOwnProperty.call(dictionary, key)) continue;
        const element = dictionary[key];
        content = content.replaceAll(`<@${key}>`, element())
    }

    // console.log(content)

    content = content.replace(regex.ss, (match, group) => {
        try {
            // Evaluate the code inside <!--$...$--> tags
            (async () => {
                // Step 1
                //
                // Create a Module by constructing a new `vm.SourceTextModule` object. This
                // parses the provided source text, throwing a `SyntaxError` if anything goes
                // wrong. By default, a Module is created in the top context. But here, we
                // specify `contextifiedObject` as the context this Module belongs to.
                //
                // Here, we attempt to obtain the default export from the module "foo", and
                // put it into local binding "secret".

                const bar = new vm.SourceTextModule(`
      import s from 'foo';
      s;
      print(s);
    `, { context: contextifiedObject });

                // Step 2
                //
                // "Link" the imported dependencies of this Module to it.
                //
                // The provided linking callback (the "linker") accepts two arguments: the
                // parent module (`bar` in this case) and the string that is the specifier of
                // the imported module. The callback is expected to return a Module that
                // corresponds to the provided specifier, with certain requirements documented
                // in `module.link()`.
                //
                // If linking has not started for the returned Module, the same linker
                // callback will be called on the returned Module.
                //
                // Even top-level Modules without dependencies must be explicitly linked. The
                // callback provided would never be called, however.
                //
                // The link() method returns a Promise that will be resolved when all the
                // Promises returned by the linker resolve.
                //
                // Note: This is a contrived example in that the linker function creates a new
                // "foo" module every time it is called. In a full-fledged module system, a
                // cache would probably be used to avoid duplicated modules.

                async function linker(specifier, referencingModule) {
                    if (specifier === 'foo') {
                        return new vm.SourceTextModule(`
          // The "secret" variable refers to the global variable we added to
          // "contextifiedObject" when creating the context.
          export default secret;
        `, { context: referencingModule.context });

                        // Using `contextifiedObject` instead of `referencingModule.context`
                        // here would work as well.
                    }
                    throw new Error(`Unable to resolve dependency: ${specifier}`);
                }
                await bar.link(linker);

                // Step 3
                //
                // Evaluate the Module. The evaluate() method returns a promise which will
                // resolve after the module has finished evaluating.

                // Prints 42.
                await bar.evaluate();
            })();
            const result = new Worker(new URL(`data:text/javascript,${group}`));
            const sanitizedResult = result !== undefined ? String(result) : '';
            return sanitizedResult;
        } catch (error) {
            // If there's an error during evaluation, return the original match
            console.error(`Error evaluating code: ${group}\nError: `, error);
            return match;
        }
    });

    // Finding all matches in the string
    const matches = content.matchAll(regex.api);

    // Logging the extracted values
    for (const match of matches) {
        const APIpath = match[1];
        const code = match[2];
        console.log(APIpath)
        s.api[`${req.path.replace("/", "")}-${APIpath}`] = code
        content = content.replace(match[0], `<!-- API endpoint definition here (${req.path.replace("/", "")}-${APIpath}) -->\n<!--\n${code}\n-->`);
    }

    content = content.replace(regex.apiHelper, (match, group) => {
        try {
            // Evaluate the code inside <%--...--%> tags
            const result = `${req.path.replace("/", "")}-${group}`;
            const sanitizedResult = result !== undefined ? String(result) : '';
            return sanitizedResult;
        } catch (error) {
            // If there's an error during evaluation, return the original match
            console.error(`Error evaluating code: ${group}\nError: `, error);
            return match;
        }
    });

    //     try {
    //         // Evaluate the code inside %{...} brackets
    //         console.log(code, match)
    //         const result = eval(code);
    //         return result !== undefined ? result : match;
    //     } catch (error) {
    //         // If there's an error during evaluation, return the original match
    //         console.error(`Error evaluating code: ${code}`);
    //         return match;
    //     }
    // });
    return content
}

const mimeTypes = {
    "htms": "text/html",
    "htmlx": "text/html",
    "html": "text/html",
    "css": "text/css",
    "xcss": "text/css",
    "png": "image/png",
    "mp4": "video/mp4"
}

app.get('*', (req, res) => {
    s.response = res;
    s.request = req;
    let splitPath = req.path.split("/")
    let splitURL = req.url.split(".")
    if (mimeTypes[splitURL[splitURL.length - 1]]) {
        res.setHeader("Content-Type", mimeTypes[splitURL[splitURL.length - 1]])
    }
    if (s.api[splitPath[splitPath.length - 1]]) {
        return res.send(String(eval(s.api[splitPath[splitPath.length - 1]])))
    }
    let pp = publicPage(req.url, req.url.startsWith("/") ? "public" : "public/")
    console.log(pp)
    switch (pp[1]) {
        case "xhtml":
            res.send(
                xhtml(req, res, pp[0])
            )
            break;
        case "htms":
            res.send(
                htms(req, res, pp[0])
            )
            break;
        case "ss":
            let code = (fs.readFileSync(pp[0])).toString()
            res.send(
                eval(code)
            )
            break;

        default:
            handle404(req, res)
            break;
    }
})

app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
})