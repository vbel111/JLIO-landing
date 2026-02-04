import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  const { qt, customQuestionText, user, uid, userId } = req.query;
  
  // Read the original HTML file
  const htmlPath = join(process.cwd(), 'public', 'ask.html');
  let html = readFileSync(htmlPath, 'utf-8');
  
  // Get the custom question text
  const questionText = qt || customQuestionText;
  
  if (questionText) {
    const decodedQuestion = decodeURIComponent(questionText);
    
    // Replace meta tags with dynamic content
    html = html.replace(
      /<meta property="og:title" content="Ask me anything on Jlio!" id="ogTitle">/,
      `<meta property="og:title" content="${decodedQuestion}" id="ogTitle">`
    );
    
    html = html.replace(
      /<meta property="og:description" content="Send an anonymous question and get a thoughtful answer" id="ogDescription">/,
      `<meta property="og:description" content="Tap to answer this question anonymously on Jlio" id="ogDescription">`
    );
    
    html = html.replace(
      /<meta name="twitter:title" content="Ask me anything on Jlio!" id="twitterTitle">/,
      `<meta name="twitter:title" content="${decodedQuestion}" id="twitterTitle">`
    );
    
    html = html.replace(
      /<meta name="twitter:description" content="Send an anonymous question and get a thoughtful answer" id="twitterDescription">/,
      `<meta name="twitter:description" content="Tap to answer this question anonymously on Jlio" id="twitterDescription">`
    );
    
    html = html.replace(
      /<title>Ask a Question - Jlio<\/title>/,
      `<title>${decodedQuestion} - Jlio</title>`
    );
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
