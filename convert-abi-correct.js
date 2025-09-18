const fs = require('fs');

// Convert JSON ABI to TypeScript - handle the wrapped format
function convertAbiToTs(jsonPath, tsPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const varName = jsonPath.includes('Factory') ? 'abiMintBountyFactory' : 'abiMintBountyNew';

  // Extract just the abi array if it's wrapped
  const abi = data.abi || data;

  const tsContent = `export const ${varName} = ${JSON.stringify(abi, null, 2)} as const;\n`;

  fs.writeFileSync(tsPath, tsContent);
  console.log(`Converted ${jsonPath} to ${tsPath}`);

  // Log some function names for verification
  const functions = abi.filter(item => item.type === 'function').map(f => f.name);
  console.log(`  Functions found: ${functions.slice(0, 10).join(', ')}${functions.length > 10 ? '...' : ''}`);
}

// Convert both files
convertAbiToTs('src/abi/abiMintBounty.json', 'src/abi/abiMintBountyNew.ts');
convertAbiToTs('src/abi/abiMintBountyFactory.json', 'src/abi/abiMintBountyFactory.ts');

console.log('Conversion complete!');