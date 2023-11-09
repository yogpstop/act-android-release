const fs = require('fs').promises;
import fetch, { FormData, Request, fileFrom } from 'node-fetch';

function gh(v) { return process.env[`GITHUB_${v}`] }
const baseName = gh('REPOSITORY').replace(/.*\//, '');
const buildType = gh('REF').startsWith('refs/tags/') ? 'release' : 'debug';

async function perform() {
    let releaseId;
    const apkDir = 'app/build/outputs/apk';
    const dir = await fs.opendir(apkDir);
    for await (const e of dir) {
        const meta = JSON.parse(await fs.readFile(`${apkDir}/${e.name}/${buildType}/output-metadata.json`, 'utf8'));
        if (gh('REF').startsWith('refs/tags/') && releaseId === undefined) {
            let url = `${gh('API_URL')}/repos/${gh('REPOSITORY')}/releases`;
            const res = await fetch(new Request(url, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${process.env.SECRET_PAT}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({tag_name: gh('REF').replace('refs/tags/', '')})
            }));
            const relJs = await res.json();
            releaseId = relJs.id;
        }
        for (const el of meta.elements) {
            const ver = encodeURIComponent(`${el.versionName} (${el.versionCode})`);
            const name = encodeURIComponent(`${baseName}-${e.name}-${buildType}-${el.versionName}.apk`);
            let url;
            const opts = {
                headers: {'Authorization': `token ${process.env.SECRET_PAT}`}
            };
            const apk = await fileFrom(`${apkDir}/${e.name}/${buildType}/${el.outputFile}`);
            if (gh('REF').startsWith('refs/tags/')) {
                url = `${gh('API_URL')}/repos/${gh('REPOSITORY')}/releases/${releaseId}/assets`;
                opts.method = 'POST';
                opts.body = new FormData();
                opts.body.set('attachment', apk, name);
            } else {
                url = `${gh('SERVER_URL')}/api/packages/${gh('REPOSITORY_OWNER')}/generic/${baseName}/${ver}/${name}`;
                opts.method = 'PUT';
                opts.body = apk;
            }
            await fetch(new Request(url, opts));
        }
    }
}
perform().then(_ => {});
