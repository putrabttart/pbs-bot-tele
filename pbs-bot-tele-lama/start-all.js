#!/usr/bin/env node

/**
 * PBS Project Manager
 * Helper script to run all services
 */

const { spawn } = require('child_process');
const path = require('path');

const services = {
  bot: {
    name: 'Telegram Bot',
    cwd: path.join(__dirname, 'bot-telegram'),
    command: 'node',
    args: ['index.js'],
    port: 'N/A',
    color: '\x1b[36m', // Cyan
  },
  dashboard: {
    name: 'Admin Dashboard',
    cwd: path.join(__dirname, 'dashboard'),
    command: 'npm',
    args: ['run', 'dev'],
    port: '3000',
    url: 'http://localhost:3000',
    color: '\x1b[35m', // Magenta
  },
  store: {
    name: 'User Web Store',
    cwd: path.join(__dirname, 'user'),
    command: 'npm',
    args: ['run', 'dev'],
    port: '3001',
    url: 'http://localhost:3001',
    color: '\x1b[33m', // Yellow
  },
};

const reset = '\x1b[0m';
const bold = '\x1b[1m';
const green = '\x1b[32m';

// Parse command line arguments
const args = process.argv.slice(2);
const serviceToRun = args[0] || 'all';

function printBanner() {
  console.log('\n' + bold + green);
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║        PBS Project Manager v1.0               ║');
  console.log('║    Run all services with one command!         ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(reset + '\n');
}

function printHelp() {
  console.log('Usage: node start-all.js [service]\n');
  console.log('Services:');
  console.log('  all        - Run all services (default)');
  console.log('  bot        - Run Telegram Bot only');
  console.log('  dashboard  - Run Admin Dashboard only');
  console.log('  store      - Run User Web Store only\n');
  console.log('Examples:');
  console.log('  node start-all.js');
  console.log('  node start-all.js bot');
  console.log('  node start-all.js dashboard\n');
}

function runService(serviceKey) {
  const service = services[serviceKey];
  const { name, cwd, command, args, port, url, color } = service;

  console.log(`${color}${bold}[${name}]${reset} Starting...`);
  
  const proc = spawn(command, args, {
    cwd,
    stdio: 'pipe',
    shell: true,
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${color}[${name}]${reset} ${line}`);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${color}[${name}]${reset} ${line}`);
      }
    });
  });

  proc.on('close', (code) => {
    console.log(`${color}[${name}]${reset} Exited with code ${code}`);
  });

  // Print access info after a delay
  setTimeout(() => {
    if (url) {
      console.log(`${color}${bold}[${name}]${reset} ${green}✓${reset} Running at: ${bold}${url}${reset}`);
    } else {
      console.log(`${color}${bold}[${name}]${reset} ${green}✓${reset} Running (Port: ${port})`);
    }
  }, 3000);

  return proc;
}

function main() {
  printBanner();

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  let servicesToStart = [];

  if (serviceToRun === 'all') {
    servicesToStart = Object.keys(services);
  } else if (services[serviceToRun]) {
    servicesToStart = [serviceToRun];
  } else {
    console.log(`${bold}Error:${reset} Unknown service "${serviceToRun}"\n`);
    printHelp();
    process.exit(1);
  }

  console.log(`Starting ${servicesToStart.length} service(s)...\n`);

  const processes = servicesToStart.map(runService);

  // Print summary after services start
  setTimeout(() => {
    console.log('\n' + bold + green + '═══════════════════════════════════════════════' + reset);
    console.log(bold + 'Services Running:' + reset);
    servicesToStart.forEach(key => {
      const service = services[key];
      if (service.url) {
        console.log(`  ${service.color}●${reset} ${service.name}: ${service.url}`);
      } else {
        console.log(`  ${service.color}●${reset} ${service.name}: Port ${service.port}`);
      }
    });
    console.log(bold + green + '═══════════════════════════════════════════════' + reset);
    console.log('\nPress Ctrl+C to stop all services\n');
  }, 5000);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down all services...');
    processes.forEach(proc => {
      proc.kill('SIGINT');
    });
    setTimeout(() => {
      console.log('All services stopped. Goodbye! 👋\n');
      process.exit(0);
    }, 1000);
  });
}

main();
