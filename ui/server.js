import express from 'express';
import { renderPage } from 'vike/server';
import { createServer } from 'http';

const app = express();

// Serve static assets (both /assets and /ui/assets)
app.use('/assets', express.static('./dist/client/assets'));
app.use('/ui/assets', express.static('./dist/client/assets'));

// SSR handler - Vike needs the full URL including /ui prefix
app.get('*', async (req, res) => {
  const pageContext = await renderPage({ urlOriginal: req.url });
  const { httpResponse } = pageContext;

  if (!httpResponse) {
    return res.status(404).send('Not found');
  }

  const { body, statusCode, contentType } = httpResponse;
  res.status(statusCode).type(contentType).send(body);
});

const server = createServer(app);
server.listen(3000, '0.0.0.0', () => {
  console.log('Server running at http://0.0.0.0:3000');
});
