#!/usr/bin/env python3.11
"""
E2B Sandbox Real-time Monitor
Provides real-time monitoring and debugging of E2B sandbox operations
"""

import os
import sys
import time
import json
from datetime import datetime

def log_with_timestamp(message, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}")

def monitor_sandbox_execution(sbx, command, timeout=600):
    """
    Monitor sandbox command execution with real-time feedback
    """
    log_with_timestamp(f"Starting monitored execution: {command[:100]}...")
    
    # Start command execution
    start_time = time.time()
    result = None
    
    try:
        # Execute command with monitoring
        log_with_timestamp("Command started, monitoring execution...")
        
        # For real implementation, you would run the command and monitor
        # This is a template for when you have valid API keys
        result = sbx.commands.run(command, timeout=timeout)
        
        elapsed = time.time() - start_time
        log_with_timestamp(f"Command completed in {elapsed:.2f} seconds")
        
        # Log execution results
        log_with_timestamp(f"Exit code: {result.exit_code}")
        if result.stdout:
            log_with_timestamp(f"STDOUT length: {len(result.stdout)} characters")
            if len(result.stdout) < 500:
                log_with_timestamp(f"STDOUT preview: {result.stdout[:200]}...")
        if result.stderr:
            log_with_timestamp(f"STDERR length: {len(result.stderr)} characters", "WARNING")
            log_with_timestamp(f"STDERR: {result.stderr}", "ERROR")
            
        return result
        
    except Exception as e:
        elapsed = time.time() - start_time
        log_with_timestamp(f"Command failed after {elapsed:.2f} seconds: {e}", "ERROR")
        raise e

def monitor_file_system(sbx, description="Monitoring file system"):
    """
    Monitor sandbox file system state
    """
    log_with_timestamp(f"📁 {description}")
    
    try:
        # Check current directory
        pwd_result = sbx.commands.run("pwd", timeout=10)
        log_with_timestamp(f"Current directory: {pwd_result.stdout.strip()}")
        
        # List files
        ls_result = sbx.commands.run("ls -la", timeout=10)
        log_with_timestamp("Directory contents:")
        for line in ls_result.stdout.split('\n')[:10]:  # Show first 10 files
            if line.strip():
                log_with_timestamp(f"  {line}")
        
        # Check disk usage
        du_result = sbx.commands.run("du -sh .", timeout=10)
        log_with_timestamp(f"Directory size: {du_result.stdout.strip()}")
        
        # Check for specific file types
        find_result = sbx.commands.run("find . -type f -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' | head -10", timeout=15)
        if find_result.stdout.strip():
            log_with_timestamp("Generated files found:")
            for file in find_result.stdout.split('\n')[:10]:
                if file.strip():
                    log_with_timestamp(f"  📄 {file.strip()}")
        
    except Exception as e:
        log_with_timestamp(f"File system monitoring error: {e}", "ERROR")

def monitor_system_resources(sbx):
    """
    Monitor sandbox system resources
    """
    log_with_timestamp("🔍 System resources check")
    
    try:
        # Memory usage
        mem_result = sbx.commands.run("free -h", timeout=10)
        log_with_timestamp("Memory usage:")
        for line in mem_result.stdout.split('\n')[:3]:
            if line.strip():
                log_with_timestamp(f"  {line}")
        
        # CPU load
        load_result = sbx.commands.run("uptime", timeout=10)
        log_with_timestamp(f"System load: {load_result.stdout.strip()}")
        
        # Process list (top 5 processes)
        ps_result = sbx.commands.run("ps aux --sort=-%cpu | head -6", timeout=10)
        log_with_timestamp("Top processes:")
        lines = ps_result.stdout.split('\n')
        for line in lines[:6]:  # Header + top 5
            if line.strip():
                log_with_timestamp(f"  {line}")
                
    except Exception as e:
        log_with_timestamp(f"System monitoring error: {e}", "ERROR")

def enhanced_sandbox_execution(prompt, components_to_install="", e2b_api_key=None, anthropic_api_key=None):
    """
    Enhanced sandbox execution with full monitoring
    This would be called instead of the basic launcher when you have valid API keys
    """
    
    log_with_timestamp("🚀 Starting enhanced E2B sandbox with monitoring")
    log_with_timestamp("=" * 60)
    
    try:
        from e2b import Sandbox
        log_with_timestamp("✅ E2B SDK imported successfully")
    except ImportError as e:
        log_with_timestamp(f"❌ E2B import failed: {e}", "ERROR")
        return False
    
    if not e2b_api_key or not anthropic_api_key:
        log_with_timestamp("❌ Missing API keys", "ERROR")
        return False
    
    try:
        # Create sandbox with monitoring
        log_with_timestamp("Creating E2B sandbox...")
        sbx = Sandbox.create(
            template="anthropic-claude-code",
            api_key=e2b_api_key,
            envs={'ANTHROPIC_API_KEY': anthropic_api_key},
            timeout=600
        )
        
        log_with_timestamp(f"✅ Sandbox created: {sbx.sandbox_id}")
        sbx.set_timeout(900)
        log_with_timestamp("⏱️  Sandbox timeout extended to 15 minutes")
        
        # Initial system check
        monitor_system_resources(sbx)
        monitor_file_system(sbx, "Initial file system state")
        
        # Install components if specified
        if components_to_install:
            log_with_timestamp(f"📦 Installing components: {components_to_install}")
            install_command = f"npx claude-code-templates@latest {components_to_install}"
            monitor_sandbox_execution(sbx, install_command, timeout=120)
            monitor_file_system(sbx, "After components installation")
        
        # Verify Claude Code installation
        log_with_timestamp("🔍 Verifying Claude Code installation")
        claude_check = monitor_sandbox_execution(sbx, "which claude", timeout=10)
        if claude_check.exit_code == 0:
            version_check = monitor_sandbox_execution(sbx, "claude --version", timeout=10)
            log_with_timestamp(f"Claude version: {version_check.stdout.strip()}")
        else:
            log_with_timestamp("❌ Claude Code not found in PATH", "ERROR")
        
        # Execute main prompt with monitoring
        log_with_timestamp("🤖 Executing Claude Code with monitoring")
        claude_command = f"echo '{prompt}' | claude -p --dangerously-skip-permissions"
        
        result = monitor_sandbox_execution(sbx, claude_command, timeout=600)
        
        # Final file system check
        monitor_file_system(sbx, "Final file system state")
        
        # Display results
        log_with_timestamp("=" * 60)
        log_with_timestamp("🎯 CLAUDE CODE RESULTS")
        log_with_timestamp("=" * 60)
        
        if result.stdout:
            print(result.stdout)
        
        if result.stderr:
            log_with_timestamp("⚠️  STDERR OUTPUT", "WARNING")
            print(result.stderr)
        
        log_with_timestamp("✅ Execution completed successfully")
        
        # Cleanup
        sbx.kill()
        log_with_timestamp("🧹 Sandbox cleaned up")
        return True
        
    except Exception as e:
        log_with_timestamp(f"❌ Execution failed: {e}", "ERROR")
        return False

def main():
    if len(sys.argv) < 2:
        print("E2B Sandbox Monitor")
        print("Usage: python e2b-monitor.py <prompt> [components] [e2b_key] [anthropic_key]")
        print()
        print("This tool provides enhanced monitoring and debugging for E2B sandbox operations.")
        print("Use this when you have valid API keys and want detailed insight into sandbox execution.")
        sys.exit(1)
    
    prompt = sys.argv[1]
    components = sys.argv[2] if len(sys.argv) > 2 else ""
    e2b_key = sys.argv[3] if len(sys.argv) > 3 else os.getenv('E2B_API_KEY')
    anthropic_key = sys.argv[4] if len(sys.argv) > 4 else os.getenv('ANTHROPIC_API_KEY')
    
    log_with_timestamp("🎬 E2B Sandbox Monitor Starting")
    log_with_timestamp("=" * 60)
    
    success = enhanced_sandbox_execution(prompt, components, e2b_key, anthropic_key)
    
    if success:
        log_with_timestamp("🎉 Monitoring session completed successfully")
    else:
        log_with_timestamp("❌ Monitoring session failed")
        sys.exit(1)

if __name__ == "__main__":
    main()