const http = require('http');

const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Initializing</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .progress {
            margin-top: 20px;
            font-size: 14px;
            color: #666;
        }
    </style>
    <script>
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    </script>
</head>
<body>
    <div class="container">
        <h2>Database is being initialized</h2>
        <div class="spinner"></div>
        <p>Please check back in a moment...</p>
        <div class="progress">Setting up your channel scheduler...</div>
        <p><small>This page will automatically refresh in 5 seconds</small></p>
    </div>
</body>
</html>`;

function createHealthServer(port = 3000) {
    const server = http.createServer((req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(htmlResponse);
    });

    return new Promise((resolve, reject) => {
        server.listen(port, '0.0.0.0', (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`Health server listening on port ${port}`);
                resolve(server);
            }
        });
    });
}

function stopHealthServer(server) {
    return new Promise((resolve) => {
        server.close(() => {
            console.log('Health server stopped');
            resolve();
        });
    });
}

module.exports = { createHealthServer, stopHealthServer };

// If this script is run directly, start the health server
if (require.main === module) {
    const port = process.env.PORT || 3000;
    createHealthServer(port).catch(console.error);
}