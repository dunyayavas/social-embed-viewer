const fs = require('fs');
const path = require('path');

// Files to combine
const files = [
  'app-supabase.js',
  'app-supabase-part2.js',
  'app-supabase-part3.js',
  'app-supabase-part4.js'
];

// Output file
const outputFile = 'app-supabase-combined.js';

// Read and combine files
let combinedContent = '';

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // For part files, extract only the methods (skip the comments)
    if (file !== 'app-supabase.js') {
      // Extract only the method implementations
      const methodsMatch = content.match(/\/\/ These methods should be added[\s\S]*$/);
      if (methodsMatch) {
        const methods = methodsMatch[0].replace(/\/\/ These methods should be added[\s\S]*?\n\n/, '');
        combinedContent += methods;
      } else {
        combinedContent += content;
      }
    } else {
      // For the main file, keep everything but add a newline at the end
      combinedContent += content + '\n';
    }
  }
});

// Write the combined content to the output file
fs.writeFileSync(path.join(__dirname, outputFile), combinedContent);

console.log(`Combined files into ${outputFile}`);
