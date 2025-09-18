const fs = require('fs');

// Convert JSON ABI to TypeScript
function convertAbiToTs(jsonPath, tsPath) {
  const abi = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const varName = jsonPath.includes('Factory') ? 'abiMintBountyFactory' : 'abiMintBountyNew';

  const tsContent = `export const ${varName} = ${JSON.stringify(abi, null, 2)} as const;\n`;

  fs.writeFileSync(tsPath, tsContent);
  console.log(`Converted ${jsonPath} to ${tsPath}`);
}

// Convert both files
convertAbiToTs('src/abi/abiMintBounty.json', 'src/abi/abiMintBountyNew.ts');
convertAbiToTs('src/abi/abiMintBountyFactory.json', 'src/abi/abiMintBountyFactory.ts');

console.log('Conversion complete!');