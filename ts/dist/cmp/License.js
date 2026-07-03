"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.License = void 0;
const jostraca_1 = require("jostraca");
const packageMeta_1 = require("../helpers/packageMeta");
// Root MIT LICENSE for the generated SDK repo. The copyright holder is the
// PUBLISHER (Voxgig): this is an unofficial, generated SDK, so it is NOT
// attributed to the upstream API owner. A non-affiliation note is appended so
// the license file itself carries the disclosure.
const License = (0, jostraca_1.cmp)(function License(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    const year = (model.const && model.const.year) || new Date().getFullYear();
    (0, jostraca_1.File)({ name: 'LICENSE' }, () => {
        (0, jostraca_1.Content)(`MIT License

Copyright (c) ${year} ${packageMeta_1.PUBLISHER}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

${(0, packageMeta_1.nonAffiliation)(model)}
`);
    });
});
exports.License = License;
//# sourceMappingURL=License.js.map