#!/bin/bash

# Vibe Coders Desktop Installer
# Beautiful installation script with spinners and colors

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Unicode symbols
CHECK_MARK="✓"
CROSS_MARK="✗"
ARROW="→"
SPARKLES="✨"

# Configuration
INSTALL_DIR="$HOME/.vibe-coders"
REPO_DIR="$INSTALL_DIR/vibe-coders-desktop"
REPO_URL="https://github.com/papay0/vibe-coders-desktop.git"
BIN_NAME="vibe-coders"
NODE_MIN_VERSION="18"

# Verbose mode
VERBOSE=false
if [[ "$*" == *--verbose* ]]; then
    VERBOSE=true
fi

# Spinner function
spinner() {
    local pid=$1
    local message=$2
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

    while ps -p "$pid" > /dev/null 2>&1; do
        local temp=${spinstr#?}
        printf " ${CYAN}%c${RESET}  %s" "$spinstr" "$message"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\r"
    done

    # Clear the line
    printf "\r\033[K"
}

# Execute command with spinner
execute_with_spinner() {
    local message=$1
    shift
    local cmd="$*"

    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}${ARROW}${RESET} ${message}"
        eval "$cmd"
        echo -e "${GREEN}${CHECK_MARK}${RESET} ${message}"
    else
        eval "$cmd" > /tmp/vibe-coders-install.log 2>&1 &
        local pid=$!
        spinner $pid "$message"
        wait $pid
        local exit_code=$?

        if [ $exit_code -eq 0 ]; then
            echo -e "${GREEN}${CHECK_MARK}${RESET} ${message}"
        else
            echo -e "${RED}${CROSS_MARK}${RESET} ${message}"
            echo -e "${RED}Error details:${RESET}"
            cat /tmp/vibe-coders-install.log
            exit 1
        fi
    fi
}

# Print banner
print_banner() {
    echo -e "${MAGENTA}"
    cat << "EOF"
╦  ╦┬┌┐ ┌─┐  ╔═╗┌─┐┌┬┐┌─┐┬─┐┌─┐
╚╗╔╝│├┴┐├┤   ║  │ │ ││├┤ ├┬┘└─┐
 ╚╝ ┴└─┘└─┘  ╚═╝└─┘─┴┘└─┘┴└─└─┘
EOF
    echo -e "${RESET}"
    echo -e "${BOLD}Vibe Coders Desktop Installer${RESET}"
    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Compare versions
version_ge() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

# Check Node.js version
check_node_version() {
    if command_exists node; then
        local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [ "$node_version" -ge "$NODE_MIN_VERSION" ]; then
            return 0
        fi
    fi
    return 1
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists apt-get; then
            echo "debian"
        elif command_exists yum; then
            echo "rhel"
        elif command_exists dnf; then
            echo "fedora"
        else
            echo "linux"
        fi
    else
        echo "unknown"
    fi
}

# Install dependencies
install_dependencies() {
    local os=$(detect_os)

    echo -e "${BOLD}Checking dependencies...${RESET}\n"

    # Check Git
    if command_exists git; then
        echo -e "${GREEN}${CHECK_MARK}${RESET} Git is installed"
    else
        echo -e "${YELLOW}${ARROW}${RESET} Git is not installed. Installing..."
        if [ "$os" = "macos" ]; then
            execute_with_spinner "Installing Git" "brew install git"
        elif [ "$os" = "debian" ]; then
            execute_with_spinner "Installing Git" "sudo apt-get update && sudo apt-get install -y git"
        elif [ "$os" = "rhel" ] || [ "$os" = "fedora" ]; then
            execute_with_spinner "Installing Git" "sudo yum install -y git"
        else
            echo -e "${RED}${CROSS_MARK}${RESET} Could not install Git automatically. Please install it manually."
            exit 1
        fi
    fi

    # Check Homebrew (macOS only)
    if [ "$os" = "macos" ]; then
        if command_exists brew; then
            echo -e "${GREEN}${CHECK_MARK}${RESET} Homebrew is installed"
        else
            echo -e "${YELLOW}${ARROW}${RESET} Homebrew is not installed. Installing..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
    fi

    # Check Node.js
    if check_node_version; then
        local node_version=$(node -v)
        echo -e "${GREEN}${CHECK_MARK}${RESET} Node.js ${node_version} is installed"
    else
        echo -e "${YELLOW}${ARROW}${RESET} Node.js v${NODE_MIN_VERSION}+ is not installed. Installing..."
        if [ "$os" = "macos" ]; then
            execute_with_spinner "Installing Node.js" "brew install node@20"
        elif [ "$os" = "debian" ]; then
            execute_with_spinner "Installing Node.js" "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
        elif [ "$os" = "rhel" ] || [ "$os" = "fedora" ]; then
            execute_with_spinner "Installing Node.js" "curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
        else
            echo -e "${RED}${CROSS_MARK}${RESET} Could not install Node.js automatically. Please install Node.js v${NODE_MIN_VERSION}+ manually."
            exit 1
        fi
    fi

    # Check npm
    if command_exists npm; then
        local npm_version=$(npm -v)
        echo -e "${GREEN}${CHECK_MARK}${RESET} npm ${npm_version} is installed"
    else
        echo -e "${RED}${CROSS_MARK}${RESET} npm is not installed (should come with Node.js)"
        exit 1
    fi

    echo ""
}

# Clone or update repository
setup_repository() {
    echo -e "${BOLD}Setting up repository...${RESET}\n"

    if [ -d "$REPO_DIR" ]; then
        echo -e "${BLUE}${ARROW}${RESET} Repository already exists. Updating..."
        cd "$REPO_DIR"
        execute_with_spinner "Pulling latest changes" "git pull origin main"
    else
        echo -e "${BLUE}${ARROW}${RESET} Cloning repository..."
        mkdir -p "$INSTALL_DIR"
        execute_with_spinner "Cloning from GitHub" "git clone $REPO_URL $REPO_DIR"
        cd "$REPO_DIR"
    fi

    echo ""
}

# Install npm packages
install_packages() {
    echo -e "${BOLD}Installing packages...${RESET}\n"

    cd "$REPO_DIR"

    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}${ARROW}${RESET} Running npm install..."
        npm install
        echo -e "${GREEN}${CHECK_MARK}${RESET} Packages installed"
    else
        execute_with_spinner "Installing npm packages (this may take a minute)" "npm install"
    fi

    echo ""
}

# Setup CLI tool
setup_cli() {
    echo -e "${BOLD}Setting up CLI tool...${RESET}\n"

    local bin_dir="$INSTALL_DIR/bin"
    mkdir -p "$bin_dir"

    # Create the CLI script
    cat > "$bin_dir/$BIN_NAME" << 'SCRIPT_EOF'
#!/bin/bash

# Vibe Coders CLI Tool

REPO_DIR="$HOME/.vibe-coders/vibe-coders-desktop"
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Check if verbose flag is present
if [[ "$*" == *--verbose* ]]; then
    VERBOSE=true
fi

# Show help
show_help() {
    echo "Vibe Coders CLI"
    echo ""
    echo "Usage:"
    echo "  vibe-coders [command] [options]"
    echo ""
    echo "Commands:"
    echo "  (none)        Start development server (default)"
    echo "  dev           Start development server"
    echo "  build         Build for production"
    echo "  start         Start production server"
    echo "  update        Update to latest version (git pull + npm install)"
    echo "  --help        Show this help message"
    echo ""
    echo "Options:"
    echo "  --verbose     Show detailed output"
    echo ""
    echo "Examples:"
    echo "  vibe-coders              # Start dev server"
    echo "  vibe-coders update       # Update to latest version"
    echo "  vibe-coders build        # Build for production"
}

# Execute command
execute_cmd() {
    if [ "$VERBOSE" = true ]; then
        "$@"
    else
        "$@" 2>&1 | grep -v "^>" | grep -v "webpack"
    fi
}

# Main logic
cd "$REPO_DIR" || exit 1

case "${1:-dev}" in
    dev|"")
        echo -e "${GREEN}Starting Vibe Coders development server...${RESET}"
        echo -e "${CYAN}Press Ctrl+C to stop${RESET}\n"
        execute_cmd npm run dev
        ;;

    build)
        echo -e "${GREEN}Building Vibe Coders...${RESET}\n"
        execute_cmd npm run build
        ;;

    start)
        echo -e "${GREEN}Starting Vibe Coders production server...${RESET}\n"
        execute_cmd npm run start
        ;;

    update)
        echo -e "${GREEN}Updating Vibe Coders...${RESET}\n"
        git pull origin main
        echo ""
        npm install
        echo -e "\n${GREEN}✓${RESET} Updated successfully!"
        ;;

    --help|-h|help)
        show_help
        ;;

    *)
        echo -e "${RED}Unknown command: $1${RESET}"
        echo ""
        show_help
        exit 1
        ;;
esac
SCRIPT_EOF

    chmod +x "$bin_dir/$BIN_NAME"
    echo -e "${GREEN}${CHECK_MARK}${RESET} CLI tool created at ${bin_dir}/${BIN_NAME}"

    # Add to PATH
    local shell_config=""
    if [ -n "$BASH_VERSION" ]; then
        shell_config="$HOME/.bashrc"
    elif [ -n "$ZSH_VERSION" ]; then
        shell_config="$HOME/.zshrc"
    else
        # Try to detect
        if [ -f "$HOME/.zshrc" ]; then
            shell_config="$HOME/.zshrc"
        elif [ -f "$HOME/.bashrc" ]; then
            shell_config="$HOME/.bashrc"
        fi
    fi

    if [ -n "$shell_config" ]; then
        if ! grep -q "vibe-coders/bin" "$shell_config" 2>/dev/null; then
            echo "" >> "$shell_config"
            echo "# Vibe Coders CLI" >> "$shell_config"
            echo "export PATH=\"\$HOME/.vibe-coders/bin:\$PATH\"" >> "$shell_config"
            echo -e "${GREEN}${CHECK_MARK}${RESET} Added to PATH in ${shell_config}"
            echo -e "${YELLOW}Note:${RESET} Run ${CYAN}source ${shell_config}${RESET} or restart your terminal"
        else
            echo -e "${GREEN}${CHECK_MARK}${RESET} Already in PATH"
        fi
    else
        echo -e "${YELLOW}${ARROW}${RESET} Could not detect shell config. Add this to your PATH manually:"
        echo -e "  ${CYAN}export PATH=\"\$HOME/.vibe-coders/bin:\$PATH\"${RESET}"
    fi

    echo ""
}

# Print success message
print_success() {
    echo -e "${GREEN}${SPARKLES}${SPARKLES}${SPARKLES}${RESET}\n"
    echo -e "${BOLD}${GREEN}Installation complete!${RESET}\n"
    echo -e "${BOLD}Next steps:${RESET}"
    echo -e "  1. ${CYAN}source ~/.zshrc${RESET} (or restart your terminal)"
    echo -e "  2. ${CYAN}vibe-coders${RESET} to start the development server"
    echo -e ""
    echo -e "${BOLD}Commands:${RESET}"
    echo -e "  ${CYAN}vibe-coders${RESET}        - Start dev server"
    echo -e "  ${CYAN}vibe-coders update${RESET} - Update to latest version"
    echo -e "  ${CYAN}vibe-coders build${RESET}  - Build for production"
    echo -e "  ${CYAN}vibe-coders --help${RESET} - Show all commands"
    echo -e ""
    echo -e "Installation directory: ${CYAN}${INSTALL_DIR}${RESET}"
    echo -e ""
    echo -e "Happy coding! ${SPARKLES}"
}

# Main installation flow
main() {
    print_banner
    install_dependencies
    setup_repository
    install_packages
    setup_cli
    print_success
}

# Run main function
main
