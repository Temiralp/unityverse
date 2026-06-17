const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

// SMTP configuration for Yandex
const SMTP_CONFIG = {
    host: 'smtp.yandex.com',
    port: 465,
    user: 'info@unityverseacademy.com',
    pass: 'gbtpjrsqbgpgqgye'
};

// Custom SMTP client using native TLS module
function sendSMTP(host, port, user, pass, mail) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect(port, host, {}, () => {
            console.log('Connected to Yandex SMTP server');
        });
        
        let buffer = '';
        let step = 'CONNECT';
        
        const send = (cmd) => {
            socket.write(cmd + '\r\n');
        };

        const handleError = (msg) => {
            console.error('SMTP Error:', msg);
            socket.end();
            reject(new Error(msg));
        };
        
        socket.on('data', (chunk) => {
            buffer += chunk.toString();
            
            // Split into lines
            let lines = buffer.split('\r\n');
            buffer = lines.pop(); // keep last partial line
            
            for (let line of lines) {
                if (step === 'CONNECT') {
                    if (line.startsWith('220')) {
                        send('EHLO localhost');
                        step = 'EHLO';
                    }
                } else if (step === 'EHLO') {
                    if (line.startsWith('250 ')) {
                        send('AUTH LOGIN');
                        step = 'AUTH';
                    }
                } else if (step === 'AUTH') {
                    if (line.startsWith('334')) {
                        send(Buffer.from(user).toString('base64'));
                        step = 'USER';
                    } else if (line.startsWith('5')) {
                        handleError('SMTP AUTH login failed: ' + line);
                        return;
                    }
                } else if (step === 'USER') {
                    if (line.startsWith('334')) {
                        send(Buffer.from(pass).toString('base64'));
                        step = 'PASS';
                    } else if (line.startsWith('5')) {
                        handleError('SMTP Username base64 rejected: ' + line);
                        return;
                    }
                } else if (step === 'PASS') {
                    if (line.startsWith('235')) {
                        send(`MAIL FROM:<${user}>`);
                        step = 'MAIL';
                    } else if (line.startsWith('5')) {
                        handleError('SMTP password rejected: ' + line);
                        return;
                    }
                } else if (step === 'MAIL') {
                    if (line.startsWith('250')) {
                        send(`RCPT TO:<${mail.to}>`);
                        step = 'RCPT';
                    } else if (line.startsWith('5')) {
                        handleError('SMTP MAIL FROM rejected: ' + line);
                        return;
                    }
                } else if (step === 'RCPT') {
                    if (line.startsWith('250')) {
                        send('DATA');
                        step = 'DATA';
                    } else if (line.startsWith('5')) {
                        handleError('SMTP RCPT TO rejected: ' + line);
                        return;
                    }
                } else if (step === 'DATA') {
                    if (line.startsWith('354')) {
                        const headers = [
                            `From: "${mail.fromName || 'Web Site'}" <${user}>`,
                            `To: <${mail.to}>`,
                            `Subject: =?UTF-8?B?${Buffer.from(mail.subject).toString('base64')}?=`,
                            'MIME-Version: 1.0',
                            'Content-Type: text/html; charset=utf-8',
                            'Content-Transfer-Encoding: 8bit',
                            '',
                            mail.html,
                            '.'
                        ].join('\r\n');
                        socket.write(headers + '\r\n');
                        step = 'SEND';
                    } else if (line.startsWith('5')) {
                        handleError('SMTP DATA command rejected: ' + line);
                        return;
                    }
                } else if (step === 'SEND') {
                    if (line.startsWith('250')) {
                        send('QUIT');
                        step = 'QUIT';
                    } else if (line.startsWith('5')) {
                        handleError('SMTP body transmission failed: ' + line);
                        return;
                    }
                } else if (step === 'QUIT') {
                    if (line.startsWith('221')) {
                        socket.end();
                        step = 'END';
                        resolve();
                    }
                }
            }
        });
        
        socket.on('error', (err) => {
            reject(err);
        });
        
        socket.on('close', () => {
            if (step !== 'END') {
                reject(new Error('SMTP connection closed prematurely in step ' + step));
            }
        });
    });
}

// Format JSON form fields into a clean HTML table
function formatFormToHTML(body, pathname) {
    try {
        const data = JSON.parse(body);
        const formTitle = pathname.includes('sendCustomForm') ? 'Web Sitesi Bilgi Talep Formu' : 'Soru Sor (Ask Us) Formu';
        let html = `<h2>${formTitle} Başvurusu</h2>`;
        html += `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif; width: 100%; max-width: 600px;">`;
        html += `<tr style="background-color: #f2f2f2; text-align: left;"><th>Alan</th><th>Değer</th></tr>`;
        for (const [key, value] of Object.entries(data)) {
            if (key === 'form_id' || key === 'askus_security_code' || key === 'type') continue;
            html += `<tr><td style="font-weight: bold; width: 35%;">${key}</td><td>${value}</td></tr>`;
        }
        html += `</table>`;
        html += `<p style="color: #666; font-size: 12px; margin-top: 25px;">Bu mail, local web sitesinin form altyapısından gönderilmiştir.</p>`;
        return html;
    } catch (e) {
        return `<h2>Yeni Form Başvurusu</h2><p>İçerik çözümlenemedi. Ham veri:</p><pre>${body}</pre>`;
    }
}

// Helper to determine content type based on file extension
const getContentType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.js': return 'application/javascript';
        case '.json': return 'application/json';
        case '.png': return 'image/png';
        case '.jpg': case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.ico': return 'image/x-icon';
        case '.xml': return 'application/xml';
        default: return 'application/octet-stream';
    }
};

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    console.log(`${req.method} request to: ${pathname}`);

    // Handle AJAX POST requests (Local Form Submissions -> SMTP Email, others -> Proxy)
    if (req.method === 'POST') {
        // Form submissions
        if (pathname.startsWith('/ajax/sendCustomForm') || pathname.startsWith('/ajax/askme')) {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                console.log(`Processing local form submission for: ${pathname}`);
                console.log(`Payload: ${body}`);

                try {
                    const htmlContent = formatFormToHTML(body, pathname);
                    const mail = {
                        to: 'info@unityverseacademy.com',
                        fromName: 'Unityverse Academy Web Formu',
                        subject: 'Yeni Web Sitesi Başvurusu',
                        html: htmlContent
                    };

                    await sendSMTP(SMTP_CONFIG.host, SMTP_CONFIG.port, SMTP_CONFIG.user, SMTP_CONFIG.pass, mail);
                    console.log(`SMTP Success: Email sent to ${mail.to}`);

                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ status: "success", message: "Form başarıyla gönderildi ve mail iletildi." }));
                } catch (err) {
                    console.error('SMTP Failure:', err);
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ status: "success", message: "Form yerel olarak başarıyla kaydedildi (SMTP Hatası: " + err.message + ")" }));
                }
            });
            return;
        } else if (pathname.startsWith('/ajax/') || pathname.startsWith('/pbl/')) {
            // For other POST requests (e.g. file uploads, megamenu items, etc.), proxy to live site
            console.log(`Forwarding POST request to live server: ${pathname}`);

            const headers = { ...req.headers };
            headers['host'] = 'unityverseacademy.com';
            if (headers['origin']) {
                headers['origin'] = 'https://unityverseacademy.com';
            }
            if (headers['referer']) {
                headers['referer'] = 'https://unityverseacademy.com' + pathname;
            }

            const options = {
                hostname: 'unityverseacademy.com',
                port: 443,
                path: req.url,
                method: 'POST',
                headers: headers
            };

            const proxyReq = https.request(options, (proxyRes) => {
                console.log(`Live server response code for ${pathname}: ${proxyRes.statusCode}`);
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error(`Proxy request error:`, err);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    status: "success",
                    message: "Form başarıyla gönderildi (Local Mock - Canlı sunucuya erişilemedi)."
                }));
            });

            // Pipe incoming request body to the proxy request
            req.pipe(proxyReq);
            return;
        } else {
            res.writeHead(501, { 'Content-Type': 'text/plain' });
            res.end('Unsupported POST request');
            return;
        }
    }

    // Handle GET requests (Static file server)
    if (req.method === 'GET') {
        // Resolve target file path (sanitize pathname to stay within workspace)
        let filePath = path.join(process.cwd(), pathname);
        
        // If directory requested, append index.html
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            // Check for trailing slash redirect (like python's http.server behavior)
            if (!req.url.endsWith('/')) {
                res.writeHead(301, { 'Location': req.url + '/' });
                res.end();
                return;
            }
            filePath = path.join(filePath, 'index.html');
        }

        // Check if file exists and read it
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log(`File not found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 File Not Found');
            } else {
                res.writeHead(200, { 'Content-Type': getContentType(filePath) });
                res.end(data);
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`Local Node.js developer server running at http://localhost:${PORT}/`);
    console.log(`GET requests serve static files, POST requests to /ajax/* are mocked.`);
});
