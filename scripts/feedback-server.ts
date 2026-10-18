import type { Plugin, Connect } from 'vite';
import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateFeedback, mergeFeedback, type Feedback } from '../src/feedback';

/** Append-only workspace snapshots; never replace a browser's earlier notes. */
export function feedbackServer(): Plugin {
  const directory = resolve(process.env.WIZARD_FEEDBACK_DIR ?? 'runs-feedback');
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/feedback') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method === 'GET') {
        await mkdir(directory, { recursive: true });
        const files = (await readdir(directory)).filter(f => f.endsWith('.json')).sort();
        let feedback: Feedback = { schema: 'wizard-battles-feedback-v1', expectations: [], notes: [] };
        for (const file of files) {
          const snapshot = JSON.parse(await readFile(join(directory, file), 'utf8'));
          validateFeedback(snapshot.feedback);
          feedback = mergeFeedback(feedback, snapshot.feedback);
        }
        res.end(JSON.stringify({ feedback, location: 'runs-feedback/', snapshots: files.length }));
      } else if (req.method === 'POST') {
        if ((req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) || !req.headers['content-type']?.startsWith('application/json')) {
          res.statusCode = 403; res.end(JSON.stringify({ error: 'Same-origin JSON required' })); return;
        }
        const chunks: Buffer[] = []; let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 2 * 1024 * 1024) { res.statusCode = 413; res.end(JSON.stringify({ error: 'Feedback exceeds 2 MB' })); return; }
          chunks.push(chunk);
        }
        const feedback: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        validateFeedback(feedback);
        await mkdir(directory, { recursive: true });
        const savedAt = new Date().toISOString();
        // Exclusive creation plus UUID keeps concurrent clients independent.
        const file = `${savedAt.replaceAll(':', '-')}-${randomUUID()}.json`;
        await writeFile(join(directory, `${file}.tmp`), JSON.stringify({ savedAt, feedback }, null, 2) + '\n', { flag: 'wx' });
        await rename(join(directory, `${file}.tmp`), join(directory, file));
        res.statusCode = 201; res.end(JSON.stringify({ savedAt, file: `runs-feedback/${file}` }));
      } else { res.statusCode = 405; res.setHeader('Allow', 'GET, POST'); res.end('{}'); }
    } catch (error) {
      res.statusCode = error instanceof SyntaxError || (error as Error).message.startsWith('Invalid') || (error as Error).message.startsWith('Unrecognized') ? 400 : 500;
      res.end(JSON.stringify({ error: 'Feedback could not be read or saved' }));
    }
  };
  return { name: 'workspace-feedback', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
