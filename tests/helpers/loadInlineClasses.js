const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_HTML_PATH = path.join(__dirname, '..', '..', 'app-v3.html');

function extractSnippet(source, name) {
    // Every top-level declaration in app-v3.html's inline script is immediately
    // followed by "window.NAME = NAME;" — used here as the extraction anchor,
    // and included in the executed snippet below since it's what attaches the
    // class/const declaration to the sandbox object (top-level class/const
    // bindings don't become global-object properties on their own).
    const pattern = new RegExp(
        `(?:class\\s+${name}\\b|const\\s+${name}\\s*=)[\\s\\S]*?\\nwindow\\.${name} = ${name};`
    );
    const match = source.match(pattern);
    if (!match) {
        throw new Error(
            `loadInlineClasses: could not find an anchored declaration for "${name}" in app-v3.html ` +
            `(expected a "window.${name} = ${name};" line immediately after its class/const declaration)`
        );
    }
    return match[0];
}

function createLocalStorageStub() {
    const store = new Map();
    return {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => { store.set(key, String(value)); },
        removeItem: key => { store.delete(key); },
        clear: () => { store.clear(); },
    };
}

// Reads app-v3.html fresh and evaluates the requested top-level declarations
// in one shared vm context, so real cross-references between them (e.g.
// ValidationUtils/CurrencyService calling into DataService) resolve exactly
// as they do in the live app. Never writes a generated file to disk.
function loadInlineClasses(names) {
    const source = fs.readFileSync(APP_HTML_PATH, 'utf8');
    const sandbox = { console, localStorage: createLocalStorageStub() };
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    names.forEach(name => {
        const snippet = extractSnippet(source, name);
        vm.runInContext(snippet, sandbox, { filename: `app-v3.html (${name})` });
    });

    const result = {};
    names.forEach(name => { result[name] = sandbox[name]; });
    return result;
}

module.exports = { loadInlineClasses };
