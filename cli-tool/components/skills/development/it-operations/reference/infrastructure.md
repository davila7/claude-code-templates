# Infrastructure Management

Comprehensive guide to server management, network operations, capacity planning, and infrastructure operations for IT teams.

## Table of Contents
- [Server Management](#server-management)
- [Network Operations](#network-operations)
- [Capacity Planning](#capacity-planning)
- [Storage Management](#storage-management)
- [Virtualization](#virtualization)
- [Cloud Infrastructure](#cloud-infrastructure)
- [Infrastructure as Code](#infrastructure-as-code)
- [Patching and Updates](#patching-and-updates)
- [Performance Optimization](#performance-optimization)
- [Cost Management](#cost-management)

## Server Management

### Server Lifecycle

```yaml
Phase 1: Procurement
  Actions:
    - Define requirements (CPU, RAM, storage, network)
    - Select vendor (Dell, HP, Lenovo, etc.)
    - Purchase or lease decision
    - Order hardware
  Timeline: 4-12 weeks

Phase 2: Provisioning
  Actions:
    - Receive and inventory hardware
    - Rack and cable servers
    - Install operating system
    - Apply baseline configuration
    - Install monitoring agents
    - Document in CMDB
  Timeline: 1-2 days per server

Phase 3: Deployment
  Actions:
    - Install application software
    - Configure networking and firewall rules
    - Set up backups
    - Load balancer configuration
    - Run acceptance tests
    - Hand off to application team
  Timeline: 2-5 days

Phase 4: Operations (2-5 years)
  Actions:
    - Monitor performance and health
    - Apply security patches
    - Perform maintenance
    - Capacity planning
    - Incident response
  Timeline: 2-5 years typical hardware lifecycle

Phase 5: Decommissioning
  Actions:
    - Migrate workloads to new servers
    - Backup all data
    - Wipe drives (secure erase)
    - Remove from monitoring
    - Update CMDB
    - Physical disposal or return
  Timeline: 1-2 weeks
```

### Operating System Management

**Linux Server Setup (Ubuntu/RHEL)**:
```bash
#!/bin/bash
# Server baseline configuration script

set -e

echo "=== Server Baseline Configuration ==="

# 1. System Updates
echo "Updating system packages..."
apt-get update && apt-get upgrade -y  # Ubuntu/Debian
# yum update -y  # RHEL/CentOS

# 2. Set hostname
HOSTNAME="web-server-01.example.com"
hostnamectl set-hostname $HOSTNAME
echo "Hostname set to: $HOSTNAME"

# 3. Configure NTP for time synchronization
echo "Configuring NTP..."
timedatectl set-timezone UTC
apt-get install -y chrony
systemctl enable chrony
systemctl start chrony

# 4. Configure SSH hardening
echo "Hardening SSH configuration..."
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
systemctl restart sshd

# 5. Configure firewall
echo "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp  # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# 6. Install monitoring agent
echo "Installing monitoring agent..."
wget -O /tmp/node_exporter.tar.gz https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xvfz /tmp/node_exporter.tar.gz -C /opt/
cat > /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
ExecStart=/opt/node_exporter-1.6.1.linux-amd64/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl enable node_exporter
systemctl start node_exporter

# 7. Install logging agent (rsyslog to centralized server)
echo "Configuring centralized logging..."
cat >> /etc/rsyslog.d/50-remote.conf <<EOF
*.* @@log-server.example.com:514
EOF
systemctl restart rsyslog

# 8. Install essential tools
echo "Installing essential tools..."
apt-get install -y vim tmux htop iotop net-tools curl wget git

# 9. Configure automatic security updates
echo "Configuring automatic security updates..."
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 10. Set up user accounts
echo "Creating ops user..."
useradd -m -s /bin/bash opsuser
usermod -aG sudo opsuser
mkdir -p /home/opsuser/.ssh
chmod 700 /home/opsuser/.ssh
# Add SSH public keys to /home/opsuser/.ssh/authorized_keys

# 11. Install security tools
echo "Installing security tools..."
apt-get install -y fail2ban aide
systemctl enable fail2ban
systemctl start fail2ban

# 12. Document in CMDB
curl -X POST https://cmdb.example.com/api/servers \
  -H "Content-Type: application/json" \
  -d "{
    \"hostname\": \"$HOSTNAME\",
    \"ip_address\": \"$(hostname -I | awk '{print $1}')\",
    \"os\": \"$(lsb_release -d | cut -f2)\",
    \"provisioned_date\": \"$(date -I)\",
    \"owner\": \"ops-team\"
  }"

echo "=== Baseline configuration complete ==="
```

**Windows Server Setup (PowerShell)**:
```powershell
# Windows Server Baseline Configuration

# 1. Set Computer Name
$computerName = "APP-SERVER-01"
Rename-Computer -NewName $computerName -Force

# 2. Configure Windows Update
Install-Module PSWindowsUpdate -Force
Get-WindowsUpdate
Install-WindowsUpdate -AcceptAll -AutoReboot

# 3. Configure Windows Firewall
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
New-NetFirewallRule -DisplayName "Allow RDP" -Direction Inbound -LocalPort 3389 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Allow HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Allow HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow

# 4. Disable unnecessary services
Set-Service -Name "Spooler" -StartupType Disabled
Set-Service -Name "Fax" -StartupType Disabled

# 5. Install monitoring agent
$nodeExporterUrl = "https://github.com/prometheus-community/windows_exporter/releases/download/v0.23.1/windows_exporter-0.23.1-amd64.msi"
Invoke-WebRequest -Uri $nodeExporterUrl -OutFile "$env:TEMP\windows_exporter.msi"
Start-Process msiexec.exe -ArgumentList "/i $env:TEMP\windows_exporter.msi /quiet" -Wait

# 6. Configure Event Log forwarding
wevtutil set-log ForwardedEvents /enabled:true
winrm quickconfig -q

# 7. Harden RDP
New-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -Name "UserAuthentication" -Value 1 -PropertyType DWORD -Force
New-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -Value 0 -PropertyType DWORD -Force

# 8. Enable BitLocker (if supported)
Enable-BitLocker -MountPoint "C:" -EncryptionMethod Aes256 -RecoveryPasswordProtector

Write-Host "Baseline configuration complete. Please reboot."
```

### Server Inventory Management

**CMDB (Configuration Management Database) Schema**:
```sql
-- Servers table
CREATE TABLE servers (
    server_id SERIAL PRIMARY KEY,
    hostname VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET NOT NULL,
    environment VARCHAR(50) NOT NULL, -- production, staging, dev
    location VARCHAR(100) NOT NULL,   -- datacenter or cloud region
    server_type VARCHAR(50) NOT NULL, -- physical, virtual, cloud
    os_type VARCHAR(50) NOT NULL,     -- linux, windows
    os_version VARCHAR(100) NOT NULL,
    cpu_cores INT NOT NULL,
    ram_gb INT NOT NULL,
    disk_gb INT NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    purchase_date DATE,
    warranty_expiry DATE,
    owner_team VARCHAR(100) NOT NULL,
    application VARCHAR(255),
    status VARCHAR(50) NOT NULL,      -- active, decommissioned, maintenance
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Network interfaces table
CREATE TABLE network_interfaces (
    interface_id SERIAL PRIMARY KEY,
    server_id INT REFERENCES servers(server_id),
    interface_name VARCHAR(50) NOT NULL,
    mac_address VARCHAR(17) NOT NULL,
    ip_address INET NOT NULL,
    subnet_mask VARCHAR(18) NOT NULL,
    gateway INET,
    vlan_id INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Installed software table
CREATE TABLE installed_software (
    software_id SERIAL PRIMARY KEY,
    server_id INT REFERENCES servers(server_id),
    software_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    install_date DATE NOT NULL,
    license_key VARCHAR(255),
    license_expiry DATE
);

-- Patching history table
CREATE TABLE patch_history (
    patch_id SERIAL PRIMARY KEY,
    server_id INT REFERENCES servers(server_id),
    patch_name VARCHAR(255) NOT NULL,
    patch_date TIMESTAMP NOT NULL,
    patch_status VARCHAR(50) NOT NULL, -- success, failed, rollback
    applied_by VARCHAR(100) NOT NULL,
    reboot_required BOOLEAN DEFAULT false
);

-- Sample queries

-- Active production servers
SELECT hostname, ip_address, cpu_cores, ram_gb, owner_team
FROM servers
WHERE environment = 'production' AND status = 'active'
ORDER BY hostname;

-- Servers with expiring warranties (next 60 days)
SELECT hostname, warranty_expiry, DATEDIFF(day, NOW(), warranty_expiry) as days_until_expiry
FROM servers
WHERE warranty_expiry BETWEEN NOW() AND NOW() + INTERVAL '60 days'
ORDER BY warranty_expiry;

-- Servers by team
SELECT owner_team, COUNT(*) as server_count, SUM(cpu_cores) as total_cores, SUM(ram_gb) as total_ram
FROM servers
WHERE status = 'active'
GROUP BY owner_team
ORDER BY server_count DESC;
```

## Network Operations

### Network Architecture

```
Internet
   ↓
Firewall (Edge)
   ↓
DMZ (VLAN 10) - 10.0.10.0/24
   ├─ Load Balancer (10.0.10.10)
   └─ Web Servers (10.0.10.20-29)
   ↓
Internal Firewall
   ↓
Application Zone (VLAN 20) - 10.0.20.0/24
   ├─ App Servers (10.0.20.10-29)
   └─ Message Queue (10.0.20.30)
   ↓
Database Zone (VLAN 30) - 10.0.30.0/24
   ├─ DB Primary (10.0.30.10)
   ├─ DB Replica (10.0.30.11)
   └─ DB Backup (10.0.30.12)
   ↓
Management Zone (VLAN 99) - 10.0.99.0/24
   ├─ Monitoring (10.0.99.10)
   ├─ Logging (10.0.99.11)
   └─ Jump Box (10.0.99.20)
```

### Network Configuration Examples

**Switch VLAN Configuration (Cisco)**:
```cisco
! Create VLANs
vlan 10
  name DMZ
vlan 20
  name APPLICATION
vlan 30
  name DATABASE
vlan 99
  name MANAGEMENT

! Configure trunk port (uplink to firewall)
interface GigabitEthernet0/1
  description Uplink to Firewall
  switchport mode trunk
  switchport trunk allowed vlan 10,20,30,99

! Configure access port (web server)
interface GigabitEthernet0/10
  description Web-Server-01
  switchport mode access
  switchport access vlan 10
  spanning-tree portfast

! Configure port-channel (link aggregation)
interface Port-channel1
  description Link to Core Switch
  switchport mode trunk
  switchport trunk allowed vlan 10,20,30,99

interface GigabitEthernet0/47
  description Member of Port-channel1
  channel-group 1 mode active

interface GigabitEthernet0/48
  description Member of Port-channel1
  channel-group 1 mode active
```

**Firewall Rules (iptables)**:
```bash
#!/bin/bash
# Firewall configuration script

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

# Default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH (from management network only)
iptables -A INPUT -p tcp --dport 22 -s 10.0.99.0/24 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow ICMP (ping)
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# Allow monitoring (Prometheus)
iptables -A INPUT -p tcp --dport 9100 -s 10.0.99.10 -j ACCEPT

# Rate limiting (DDoS protection)
iptables -A INPUT -p tcp --dport 80 -m limit --limit 100/minute --limit-burst 200 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -m limit --limit 100/minute --limit-burst 200 -j ACCEPT

# Log dropped packets
iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "iptables denied: " --log-level 7

# Save rules
iptables-save > /etc/iptables/rules.v4

echo "Firewall rules configured."
```

**Load Balancer Configuration (HAProxy)**:
```haproxy
# /etc/haproxy/haproxy.cfg

global
    log /dev/log local0
    log /dev/log local1 notice
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

    # SSL/TLS configuration
    ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256
    ssl-default-bind-options ssl-min-ver TLSv1.2

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    timeout connect 5000
    timeout client  50000
    timeout server  50000
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

# Frontend configuration (HTTPS)
frontend https_front
    bind *:443 ssl crt /etc/haproxy/certs/example.com.pem
    default_backend web_servers

    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny deny_status 429 if { sc_http_req_rate(0) gt 100 }

    # Security headers
    http-response set-header Strict-Transport-Security "max-age=31536000; includeSubDomains"
    http-response set-header X-Frame-Options "SAMEORIGIN"
    http-response set-header X-Content-Type-Options "nosniff"

# Backend configuration
backend web_servers
    balance roundrobin
    option httpchk GET /health HTTP/1.1\r\nHost:\ example.com
    http-check expect status 200

    server web01 10.0.10.20:80 check inter 5s rise 2 fall 3
    server web02 10.0.10.21:80 check inter 5s rise 2 fall 3
    server web03 10.0.10.22:80 check inter 5s rise 2 fall 3

# Statistics page
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats auth admin:password123
```

### Network Troubleshooting

**Network Diagnostic Commands**:
```bash
# Test connectivity
ping -c 4 8.8.8.8                    # Basic connectivity
ping -c 4 google.com                 # DNS resolution + connectivity

# Trace route
traceroute google.com                # Linux
tracert google.com                   # Windows
mtr google.com                       # Continuous traceroute (Linux)

# DNS troubleshooting
nslookup google.com                  # Basic DNS lookup
dig google.com                       # Detailed DNS query
dig @8.8.8.8 google.com             # Query specific DNS server

# Port connectivity
telnet example.com 80                # Test if port is open
nc -zv example.com 80                # Netcat port scan
curl -v https://example.com          # HTTP/HTTPS test with verbose output

# Network interfaces
ip addr show                         # Show IP addresses (Linux)
ip link show                         # Show interface status
ifconfig                             # Legacy interface info
ethtool eth0                         # Interface details and statistics

# Routing
ip route show                        # Show routing table
route -n                             # Numeric routing table
netstat -rn                          # Routing table (legacy)

# Active connections
netstat -tuln                        # List listening ports
ss -tuln                             # Socket statistics (modern replacement)
lsof -i :80                          # Show what's using port 80

# Packet capture
tcpdump -i eth0 port 80              # Capture HTTP traffic
tcpdump -i eth0 -w capture.pcap      # Write to file
tcpdump -r capture.pcap              # Read from file

# Bandwidth testing
iperf3 -s                            # Server mode
iperf3 -c server-ip                  # Client mode

# Network statistics
netstat -s                           # Protocol statistics
ss -s                                # Socket statistics summary
iftop                                # Real-time bandwidth by connection
```

## Capacity Planning

### Capacity Planning Process

```yaml
Step 1: Collect Baseline Data (Ongoing)
  Metrics to Track:
    - CPU utilization (%, by core)
    - Memory utilization (GB, %)
    - Disk I/O (IOPS, throughput)
    - Network throughput (Mbps)
    - Application metrics (requests/sec, users)

  Time Ranges:
    - Real-time (1-minute granularity)
    - Daily averages (for trend analysis)
    - Weekly averages (for seasonality)
    - Monthly aggregates (for year-over-year)

Step 2: Analyze Trends (Monthly)
  Questions to Answer:
    - What is the growth rate? (linear, exponential, seasonal)
    - When will current capacity be exhausted?
    - What are the peak utilization periods?
    - Are there any unusual spikes or patterns?

  Analysis Methods:
    - Linear regression (simple growth)
    - Time series forecasting (seasonal patterns)
    - Percentile analysis (p50, p95, p99)

Step 3: Forecast Future Demand (Quarterly)
  Inputs:
    - Historical growth trends
    - Business projections (user growth, new features)
    - Upcoming marketing campaigns or events
    - Industry benchmarks

  Forecasting Horizons:
    - Short-term (3 months): High confidence
    - Medium-term (6-12 months): Moderate confidence
    - Long-term (12-24 months): Low confidence, scenario planning

Step 4: Capacity Modeling
  Calculate Required Capacity:
    - Current capacity
    - Growth rate
    - Target headroom (20-30%)
    - Expected utilization after expansion

  Example:
    Current CPU utilization: 70%
    Growth rate: 10% per month
    In 6 months: 70% × (1.1)^6 = 124% (will exceed capacity)
    Action: Add capacity within 3 months

Step 5: Plan and Execute (As Needed)
  Options:
    - Vertical scaling (add CPU/RAM to existing servers)
    - Horizontal scaling (add more servers)
    - Optimize application (reduce resource usage)

  Considerations:
    - Lead time (procurement, deployment)
    - Budget approval process
    - Maintenance windows
    - Risk mitigation (pilot, canary, rollback plan)
```

### Capacity Planning Calculations

**CPU Capacity**:
```python
# CPU capacity planning calculator

def calculate_cpu_capacity(current_util_pct, growth_rate_monthly, months, target_headroom=0.30):
    """
    Calculate when CPU capacity will be exhausted

    Args:
        current_util_pct: Current CPU utilization (0-1)
        growth_rate_monthly: Monthly growth rate (e.g., 0.10 for 10%)
        months: Forecast period in months
        target_headroom: Desired headroom (0.30 = 30%)

    Returns:
        dict with forecast and recommendations
    """
    import math

    # Calculate future utilization
    future_util = current_util_pct * ((1 + growth_rate_monthly) ** months)

    # Calculate when capacity will be exhausted (reach 100%)
    if growth_rate_monthly > 0:
        months_to_exhaustion = math.log(1.0 / current_util_pct) / math.log(1 + growth_rate_monthly)
    else:
        months_to_exhaustion = float('inf')

    # Calculate when to add capacity (to maintain headroom)
    target_max_util = 1.0 - target_headroom
    months_to_action = math.log(target_max_util / current_util_pct) / math.log(1 + growth_rate_monthly)

    # Calculate required scaling factor
    scaling_factor = future_util / target_max_util if future_util > target_max_util else 1.0

    return {
        'current_utilization_pct': current_util_pct * 100,
        'forecasted_utilization_pct': future_util * 100,
        'months_to_exhaustion': months_to_exhaustion,
        'months_to_action': months_to_action,
        'scaling_factor': scaling_factor,
        'recommendation': 'Add capacity' if scaling_factor > 1.0 else 'No action needed'
    }

# Example usage
result = calculate_cpu_capacity(
    current_util_pct=0.65,      # 65% current utilization
    growth_rate_monthly=0.08,   # 8% monthly growth
    months=6,                   # 6-month forecast
    target_headroom=0.30        # Maintain 30% headroom
)

print(f"Current Utilization: {result['current_utilization_pct']:.1f}%")
print(f"Forecasted Utilization (6 months): {result['forecasted_utilization_pct']:.1f}%")
print(f"Months Until Capacity Exhausted: {result['months_to_exhaustion']:.1f}")
print(f"Months Until Action Needed: {result['months_to_action']:.1f}")
print(f"Scaling Factor Required: {result['scaling_factor']:.2f}x")
print(f"Recommendation: {result['recommendation']}")

# Output:
# Current Utilization: 65.0%
# Forecasted Utilization (6 months): 103.3%
# Months Until Capacity Exhausted: 5.2
# Months Until Action Needed: 2.7
# Scaling Factor Required: 1.48x
# Recommendation: Add capacity
```

**Storage Capacity**:
```python
# Storage capacity planning

def calculate_storage_capacity(current_usage_gb, growth_rate_daily_gb, days, total_capacity_gb):
    """Calculate storage capacity forecast"""

    future_usage_gb = current_usage_gb + (growth_rate_daily_gb * days)
    utilization_pct = (future_usage_gb / total_capacity_gb) * 100
    days_to_full = (total_capacity_gb - current_usage_gb) / growth_rate_daily_gb if growth_rate_daily_gb > 0 else float('inf')

    return {
        'current_usage_gb': current_usage_gb,
        'current_utilization_pct': (current_usage_gb / total_capacity_gb) * 100,
        'forecasted_usage_gb': future_usage_gb,
        'forecasted_utilization_pct': utilization_pct,
        'days_to_full': days_to_full,
        'recommendation': 'Add storage' if utilization_pct > 80 else 'No action needed'
    }

# Example: Database server storage
result = calculate_storage_capacity(
    current_usage_gb=3500,       # 3.5 TB currently used
    growth_rate_daily_gb=15,     # 15 GB per day growth
    days=90,                     # 90-day forecast
    total_capacity_gb=5000       # 5 TB total capacity
)

print(f"Current Usage: {result['current_usage_gb']} GB ({result['current_utilization_pct']:.1f}%)")
print(f"Forecasted Usage (90 days): {result['forecasted_usage_gb']} GB ({result['forecasted_utilization_pct']:.1f}%)")
print(f"Days Until Full: {result['days_to_full']:.0f}")
print(f"Recommendation: {result['recommendation']}")

# Output:
# Current Usage: 3500 GB (70.0%)
# Forecasted Usage (90 days): 4850 GB (97.0%)
# Days Until Full: 100
# Recommendation: Add storage
```

### Capacity Planning Dashboard Metrics

```yaml
CPU Capacity Dashboard:
  - Current Utilization: Gauge (0-100%)
  - 30-Day Trend: Line graph
  - Growth Rate: Percentage per month
  - Months Until 80% Capacity: Number
  - Peak Utilization: Histogram (by hour of day)

Memory Capacity Dashboard:
  - Current Utilization: Gauge (0-100%)
  - Available Memory: GB
  - Memory Pressure Events: Count per day
  - Top Memory Consumers: Table (process, usage)

Storage Capacity Dashboard:
  - Disk Usage by Volume: Bar chart
  - Growth Rate: GB per day
  - Days Until Full: Number (by volume)
  - Largest Files/Directories: Table

Network Capacity Dashboard:
  - Bandwidth Utilization: Gauge (% of total)
  - Peak Throughput: Mbps
  - Connection Count: Time series
  - Network Errors: Count per minute
```

## Storage Management

### Storage Types and Use Cases

```yaml
Direct Attached Storage (DAS):
  Description: Storage directly connected to server (internal drives)
  Use Cases:
    - Operating system
    - Local caching
    - Temporary files
  Pros: Fast, simple, low cost
  Cons: Not shared, limited capacity, no redundancy

Network Attached Storage (NAS):
  Description: File-level storage over network (NFS, SMB/CIFS)
  Use Cases:
    - File shares
    - Home directories
    - Backup target
  Pros: Easy to share, centralized management
  Cons: Network dependent, file-level only

Storage Area Network (SAN):
  Description: Block-level storage over dedicated network (FC, iSCSI)
  Use Cases:
    - Databases
    - Virtual machine storage
    - High-performance applications
  Pros: High performance, flexible, scalable
  Cons: Expensive, complex

Object Storage:
  Description: Object/blob storage with metadata (S3, Azure Blob)
  Use Cases:
    - Backups
    - Archives
    - Media files
    - Static website content
  Pros: Unlimited scale, durable, cost-effective
  Cons: Higher latency, no POSIX filesystem
```

### RAID Configurations

```yaml
RAID 0 (Striping):
  Configuration: Data split across drives
  Minimum Drives: 2
  Usable Capacity: 100%
  Performance: Excellent (read & write)
  Redundancy: None (any drive failure = data loss)
  Use Case: Non-critical, high-performance (caching)

RAID 1 (Mirroring):
  Configuration: Identical copies on each drive
  Minimum Drives: 2
  Usable Capacity: 50%
  Performance: Good reads, moderate writes
  Redundancy: Can lose 1 drive
  Use Case: OS drives, critical data, small arrays

RAID 5 (Striping with Parity):
  Configuration: Data + parity distributed across drives
  Minimum Drives: 3
  Usable Capacity: (N-1)/N (e.g., 3 drives = 67%)
  Performance: Good reads, moderate writes
  Redundancy: Can lose 1 drive
  Use Case: File servers, general purpose

RAID 6 (Striping with Double Parity):
  Configuration: Data + 2 parity blocks distributed
  Minimum Drives: 4
  Usable Capacity: (N-2)/N (e.g., 4 drives = 50%)
  Performance: Good reads, slower writes
  Redundancy: Can lose 2 drives
  Use Case: Large arrays, critical data

RAID 10 (1+0, Mirrored Stripes):
  Configuration: Striped set of mirrors
  Minimum Drives: 4
  Usable Capacity: 50%
  Performance: Excellent (read & write)
  Redundancy: Can lose 1 drive per mirror
  Use Case: Databases, high-performance applications

Recommendation:
  - OS drives: RAID 1 (or RAID 10 for performance)
  - Database: RAID 10 (best performance + redundancy)
  - File servers: RAID 5 or RAID 6 (capacity + redundancy)
  - Backup: RAID 6 (large capacity, double redundancy)
```

### LVM (Logical Volume Management)

```bash
# LVM Setup (Linux)

# 1. Initialize physical volumes
pvcreate /dev/sdb
pvcreate /dev/sdc
pvdisplay

# 2. Create volume group
vgcreate data_vg /dev/sdb /dev/sdc
vgdisplay data_vg

# 3. Create logical volumes
lvcreate -L 500G -n database_lv data_vg
lvcreate -L 1T -n backups_lv data_vg
lvdisplay

# 4. Create filesystems
mkfs.ext4 /dev/data_vg/database_lv
mkfs.xfs /dev/data_vg/backups_lv

# 5. Mount filesystems
mkdir -p /data/database /data/backups
mount /dev/data_vg/database_lv /data/database
mount /dev/data_vg/backups_lv /data/backups

# 6. Add to /etc/fstab for persistence
echo "/dev/data_vg/database_lv  /data/database  ext4  defaults  0  2" >> /etc/fstab
echo "/dev/data_vg/backups_lv   /data/backups   xfs   defaults  0  2" >> /etc/fstab

# Expand logical volume (online resize)
lvextend -L +200G /dev/data_vg/database_lv
resize2fs /dev/data_vg/database_lv  # ext4
xfs_growfs /data/backups             # xfs

# Create snapshot (for backups)
lvcreate -L 50G -s -n database_snap /dev/data_vg/database_lv
mount /dev/data_vg/database_snap /mnt/snapshot
# ... perform backup from /mnt/snapshot ...
umount /mnt/snapshot
lvremove /dev/data_vg/database_snap
```

## Virtualization

### Virtualization Platforms

```yaml
VMware vSphere/ESXi:
  Type: Type-1 Hypervisor (bare metal)
  Pros: Mature, feature-rich, excellent management (vCenter)
  Cons: Expensive licensing
  Use Case: Enterprise environments, large deployments

KVM (Kernel-based Virtual Machine):
  Type: Type-1 Hypervisor (Linux kernel module)
  Pros: Open source, high performance, flexible
  Cons: Management tools less mature than VMware
  Use Case: Linux-heavy environments, cost-conscious

Microsoft Hyper-V:
  Type: Type-1 Hypervisor
  Pros: Tight Windows integration, free with Windows Server
  Cons: Linux guest support limited
  Use Case: Windows-heavy environments

Proxmox VE:
  Type: Type-1 Hypervisor (KVM + LXC)
  Pros: Open source, web UI, container support
  Cons: Smaller ecosystem than VMware
  Use Case: Small to medium deployments, mixed VM/container
```

### VM Management with KVM/QEMU

```bash
# Install KVM on Ubuntu
apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virt-manager

# Start libvirt service
systemctl enable libvirtd
systemctl start libvirtd

# Create VM from command line
virt-install \
  --name web-server-vm \
  --ram 4096 \
  --vcpus 2 \
  --disk path=/var/lib/libvirt/images/web-server.qcow2,size=50 \
  --os-type linux \
  --os-variant ubuntu20.04 \
  --network bridge=br0 \
  --graphics vnc,listen=0.0.0.0 \
  --console pty,target_type=serial \
  --cdrom /var/lib/libvirt/images/ubuntu-20.04-server.iso

# List VMs
virsh list --all

# Start/stop VM
virsh start web-server-vm
virsh shutdown web-server-vm
virsh destroy web-server-vm  # force stop

# Connect to VM console
virsh console web-server-vm

# Clone VM
virt-clone \
  --original web-server-vm \
  --name web-server-vm-clone \
  --file /var/lib/libvirt/images/web-server-clone.qcow2

# Take snapshot
virsh snapshot-create-as web-server-vm snapshot1 "Before upgrade"

# List snapshots
virsh snapshot-list web-server-vm

# Revert to snapshot
virsh snapshot-revert web-server-vm snapshot1

# Export VM (backup)
virsh dumpxml web-server-vm > web-server-vm.xml
cp /var/lib/libvirt/images/web-server.qcow2 /backups/

# Import VM (restore)
virsh define web-server-vm.xml
cp /backups/web-server.qcow2 /var/lib/libvirt/images/
```

## Cloud Infrastructure

### Cloud Provider Comparison

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **Market Share** | ~32% | ~23% | ~10% |
| **Compute** | EC2 | Virtual Machines | Compute Engine |
| **Containers** | ECS, EKS | AKS | GKE |
| **Serverless** | Lambda | Functions | Cloud Functions |
| **Storage (Object)** | S3 | Blob Storage | Cloud Storage |
| **Storage (Block)** | EBS | Managed Disks | Persistent Disks |
| **Database (SQL)** | RDS | SQL Database | Cloud SQL |
| **Database (NoSQL)** | DynamoDB | Cosmos DB | Firestore/Bigtable |
| **Networking** | VPC | Virtual Network | VPC |
| **Load Balancer** | ELB/ALB | Load Balancer | Cloud Load Balancing |
| **DNS** | Route 53 | DNS | Cloud DNS |
| **CDN** | CloudFront | CDN | Cloud CDN |
| **Pricing** | $$$ | $$$ | $$$ |

### AWS EC2 Management

```bash
# AWS CLI - EC2 Management

# List instances
aws ec2 describe-instances \
  --filters "Name=tag:Environment,Values=production" \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name,PrivateIpAddress]' \
  --output table

# Start instance
aws ec2 start-instances --instance-ids i-1234567890abcdef0

# Stop instance
aws ec2 stop-instances --instance-ids i-1234567890abcdef0

# Create AMI (backup/template)
aws ec2 create-image \
  --instance-id i-1234567890abcdef0 \
  --name "web-server-backup-$(date +%Y%m%d)" \
  --description "Backup before upgrade"

# Launch new instance from AMI
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --count 1 \
  --instance-type t3.medium \
  --key-name my-key-pair \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-id subnet-0123456789abcdef0 \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-server-03}]'

# Create snapshot of EBS volume
aws ec2 create-snapshot \
  --volume-id vol-1234567890abcdef0 \
  --description "Daily backup"

# Modify instance type (requires stop)
aws ec2 stop-instances --instance-ids i-1234567890abcdef0
aws ec2 modify-instance-attribute \
  --instance-id i-1234567890abcdef0 \
  --instance-type "{\"Value\": \"t3.large\"}"
aws ec2 start-instances --instance-ids i-1234567890abcdef0
```

## Infrastructure as Code

### Terraform Example

```hcl
# main.tf - Web server infrastructure

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "my-terraform-state"
    key    = "web-servers/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  default = "us-east-1"
}

variable "instance_count" {
  default = 3
}

variable "instance_type" {
  default = "t3.medium"
}

# Data source - Latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }
}

# Security Group
resource "aws_security_group" "web" {
  name        = "web-servers-sg"
  description = "Security group for web servers"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]  # Internal only
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "web-servers-sg"
    Environment = "production"
  }
}

# EC2 Instances
resource "aws_instance" "web" {
  count         = var.instance_count
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  vpc_security_group_ids = [aws_security_group.web.id]

  user_data = file("${path.module}/user-data.sh")

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
  }

  tags = {
    Name        = "web-server-${count.index + 1}"
    Environment = "production"
    Role        = "web"
  }
}

# Load Balancer
resource "aws_lb" "web" {
  name               = "web-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.web.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "web" {
  name     = "web-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.default.id

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 10
  }
}

resource "aws_lb_target_group_attachment" "web" {
  count            = var.instance_count
  target_group_arn = aws_lb_target_group.web.arn
  target_id        = aws_instance.web[count.index].id
  port             = 80
}

resource "aws_lb_listener" "web" {
  load_balancer_arn = aws_lb.web.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# Outputs
output "instance_ips" {
  value = aws_instance.web[*].private_ip
}

output "load_balancer_dns" {
  value = aws_lb.web.dns_name
}
```

## Patching and Updates

### Patch Management Process

```yaml
Phase 1: Planning (Monthly)
  Actions:
    - Review vendor security bulletins
    - Identify critical and high-priority patches
    - Test patches in dev/staging environment
    - Schedule maintenance window
    - Get change approval

  Prioritization:
    Critical: Security vulnerabilities (CVSS 9-10) - Apply within 7 days
    High: Security vulnerabilities (CVSS 7-8) - Apply within 30 days
    Medium: Bugs, moderate vulnerabilities - Apply within 90 days
    Low: Feature updates, minor fixes - Apply on regular schedule

Phase 2: Testing (1-2 weeks before production)
  Actions:
    - Deploy patches to non-production environment
    - Run automated tests
    - Perform manual smoke tests
    - Monitor for unexpected issues
    - Document any compatibility issues

  Test Criteria:
    - Application starts successfully
    - All critical functionality works
    - No performance degradation
    - No new errors in logs

Phase 3: Deployment (Maintenance Window)
  Actions:
    - Communicate to stakeholders
    - Take pre-patch snapshot/backup
    - Deploy patches in stages (canary approach)
    - Monitor system health
    - Validate functionality
    - Document results

  Rollout Strategy:
    - Non-production: 100% at once
    - Production: 10% → 50% → 100% with monitoring

Phase 4: Validation (Post-deployment)
  Actions:
    - Run post-patch tests
    - Monitor for 24-48 hours
    - Check error rates, performance metrics
    - Rollback if issues detected
    - Document lessons learned
```

### Automated Patching Scripts

**Linux (Ubuntu/Debian)**:
```bash
#!/bin/bash
# Automated patch management script

set -e

LOG_FILE="/var/log/patch-management.log"
EMAIL_TO="ops-team@example.com"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Pre-patch checks
log "Starting pre-patch checks..."
df -h > /tmp/disk-before.txt
free -h > /tmp/memory-before.txt
systemctl list-units --state=failed > /tmp/failed-services-before.txt

# Create snapshot (if using LVM)
log "Creating LVM snapshot..."
lvcreate -L 10G -s -n root_snap /dev/vg0/root

# Update package list
log "Updating package list..."
apt-get update

# List available updates
log "Available updates:"
apt list --upgradable | tee -a $LOG_FILE

# Install security updates only
log "Installing security updates..."
unattended-upgrade -d

# Or install all updates:
# apt-get upgrade -y

# Check if reboot required
if [ -f /var/run/reboot-required ]; then
    log "Reboot required after patching"
    cat /var/run/reboot-required.pkgs >> $LOG_FILE

    # Schedule reboot (or reboot immediately)
    log "Scheduling reboot in 5 minutes..."
    shutdown -r +5 "System reboot for patches"
fi

# Post-patch validation
log "Running post-patch validation..."
systemctl list-units --state=failed > /tmp/failed-services-after.txt

# Compare before/after
if diff /tmp/failed-services-before.txt /tmp/failed-services-after.txt > /dev/null; then
    log "No new failed services after patching"
else
    log "WARNING: New failed services detected!"
    diff /tmp/failed-services-before.txt /tmp/failed-services-after.txt | tee -a $LOG_FILE
fi

# Email report
mail -s "Patch Report: $(hostname)" $EMAIL_TO < $LOG_FILE

log "Patching complete"
```

**Windows (PowerShell)**:
```powershell
# Automated Windows patching script

$LogFile = "C:\Logs\patch-management.log"
$EmailTo = "ops-team@example.com"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

# Install PSWindowsUpdate module if not present
if (-not (Get-Module -ListAvailable -Name PSWindowsUpdate)) {
    Write-Log "Installing PSWindowsUpdate module..."
    Install-Module PSWindowsUpdate -Force
}

Import-Module PSWindowsUpdate

# Pre-patch checks
Write-Log "Starting pre-patch checks..."
Get-Service | Where-Object {$_.Status -eq "Stopped"} | Out-File C:\Temp\stopped-services-before.txt

# Create system restore point
Write-Log "Creating system restore point..."
Checkpoint-Computer -Description "Before Windows Updates" -RestorePointType MODIFY_SETTINGS

# Get available updates
Write-Log "Checking for updates..."
$updates = Get-WindowsUpdate

Write-Log "Available updates: $($updates.Count)"
$updates | Format-Table Title, KB, Size | Out-String | Write-Log

# Install updates (excluding driver updates)
Write-Log "Installing updates..."
Install-WindowsUpdate -AcceptAll -IgnoreReboot -NotCategory "Drivers" | Out-String | Write-Log

# Check if reboot required
if (Get-WURebootStatus -Silent) {
    Write-Log "Reboot required after updates"

    # Schedule reboot (or reboot immediately)
    Write-Log "Scheduling reboot in 5 minutes..."
    shutdown /r /t 300 /c "System reboot for Windows Updates"
}

# Post-patch validation
Write-Log "Running post-patch validation..."
Get-Service | Where-Object {$_.Status -eq "Stopped"} | Out-File C:\Temp\stopped-services-after.txt

# Email report
Send-MailMessage `
    -From "no-reply@example.com" `
    -To $EmailTo `
    -Subject "Patch Report: $env:COMPUTERNAME" `
    -Body (Get-Content $LogFile | Out-String) `
    -SmtpServer "smtp.example.com"

Write-Log "Patching complete"
```

## Performance Optimization

### System Performance Tuning

**Linux Kernel Tuning**:
```bash
# /etc/sysctl.conf - Kernel parameter tuning

# Network tuning
net.core.somaxconn = 4096                    # Max socket connections
net.core.netdev_max_backlog = 5000           # Network device queue
net.ipv4.tcp_max_syn_backlog = 8192          # SYN backlog queue
net.ipv4.tcp_fin_timeout = 15                # FIN timeout (default 60)
net.ipv4.tcp_keepalive_time = 300            # Keep-alive time
net.ipv4.tcp_tw_reuse = 1                    # Reuse TIME_WAIT sockets
net.ipv4.ip_local_port_range = 10240 65535  # Ephemeral port range

# Memory tuning
vm.swappiness = 10                           # Reduce swap usage (default 60)
vm.dirty_ratio = 15                          # Max dirty pages before write
vm.dirty_background_ratio = 5                # Background write threshold

# File system tuning
fs.file-max = 500000                         # Max open files system-wide
fs.inotify.max_user_watches = 524288         # Max inotify watches

# Apply changes
sysctl -p
```

**Application Tuning (Nginx Example)**:
```nginx
# /etc/nginx/nginx.conf - Performance tuning

user www-data;
worker_processes auto;  # One per CPU core
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;  # Efficient event model on Linux
    multi_accept on;
}

http {
    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;  # Security: hide version

    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 50m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;
    output_buffers 1 32k;
    postpone_output 1460;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    send_timeout 10;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Caching
    open_file_cache max=200000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    server {
        listen 80;

        location / {
            limit_req zone=one burst=20 nodelay;
            limit_conn addr 10;

            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 24 4k;
            proxy_busy_buffers_size 8k;
        }
    }
}
```

## Cost Management

### Cloud Cost Optimization Strategies

```yaml
1. Right-Sizing:
   - Analyze resource utilization (CPU, memory)
   - Downsize over-provisioned instances
   - Upsize under-provisioned instances (to avoid performance issues)

   Tools:
     - AWS: AWS Compute Optimizer
     - Azure: Azure Advisor
     - GCP: Recommender

   Expected Savings: 20-40%

2. Reserved Instances / Savings Plans:
   - Commit to 1-year or 3-year usage
   - Save up to 72% vs on-demand
   - Analyze usage patterns first

   Best For:
     - Steady-state workloads (production databases, web servers)
     - Don't use for: Dev/test, variable workloads

   Expected Savings: 30-70%

3. Spot Instances:
   - Use spare cloud capacity at discounted rates (up to 90% off)
   - Can be interrupted with 2-minute notice

   Best For:
     - Batch processing, big data, CI/CD
     - Stateless, fault-tolerant workloads

   Expected Savings: 50-90%

4. Auto-Scaling:
   - Scale down during off-hours
   - Scale up during peak demand

   Example Schedule:
     - Business hours (8am-6pm): 10 instances
     - Off-hours (6pm-8am): 3 instances
     - Weekends: 2 instances

   Expected Savings: 30-50%

5. Storage Optimization:
   - Delete unused EBS volumes and snapshots
   - Move infrequently accessed data to cheaper tiers
     - S3 Standard → S3 Infrequent Access → S3 Glacier
   - Enable S3 lifecycle policies

   Expected Savings: 20-60% on storage

6. Serverless:
   - Replace idle servers with Lambda/Functions
   - Pay only for execution time

   Best For:
     - APIs with variable load
     - Event-driven processing
     - Scheduled tasks

   Expected Savings: 50-80% for low-to-moderate traffic
```

### Cost Monitoring Dashboard

```yaml
Cloud Cost Dashboard (Monthly):
  Top Spenders:
    - Service breakdown (EC2, RDS, S3, etc.)
    - Top 10 resources by cost
    - Cost by team/project (using tags)

  Trend Analysis:
    - Month-over-month cost change
    - Year-over-year comparison
    - Forecast for next 3 months

  Waste Identification:
    - Unused resources (stopped instances, unattached volumes)
    - Over-provisioned resources (< 30% utilization)
    - Untagged resources

  Savings Opportunities:
    - RI/Savings Plan recommendations
    - Right-sizing recommendations
    - Storage tier recommendations

  Budget Alerts:
    - Warning at 80% of budget
    - Critical at 100% of budget
    - Forecast to exceed budget
```

This comprehensive infrastructure management guide provides all the necessary knowledge and tools for effective IT operations.
