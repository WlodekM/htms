import { parse } from 'node-html-parser';
import fs from "fs"

export function HTMSparser(req, res, file) {
    let parsed = parse(file);
    parsed.querySelectorAll("api[path]").forEach((a, i) => {
        console.log(`Found api tag with path ${a.attributes.path}`)
        a.replaceWith(`<!-- API definition here -->`)
    })
    parsed.querySelectorAll("include").forEach((a, i) => {
        console.log(`Found include tag with path ${a.attrs.path}`)
        let imported
        try {
            imported = (`<!-- Included code from ${a.attrs.path} -->\n${fs.readFileSync(a.attrs.path)}<!-- End included code -->`)
        } catch (err) {
            imported = `<!-- Error: ${err} -->`
        }
        a.replaceWith(imported)
    })
    parsed.querySelectorAll("ss").forEach((a, i) => {
        console.log(`ss tag ${a.innerText}`)
        let result = eval(a.innerText)
        console.log(result)
        a.replaceWith(result)
    })
    console.log(parsed.toString())
}

HTMSparser({}, {}, "<api path='hi'>blah blah blah</api><p>Hi!</p><include path=\"./startup.ss\" /><ss>1+2</ss>")