import minecraft_launcher_lib
import subprocess
import argparse
import random

# Argumente vom Terminal abfragen
def parse_arguments():
    parser = argparse.ArgumentParser(description="Minecraft Launcher Script")
    parser.add_argument('--uuid', type=str, required=True, help='MCID (UUID) der Person')
    parser.add_argument('--name', type=str, required=True, help='Name des Spielers')
    parser.add_argument('--token', type=str, required=False, help='Access Token für Online-Server')
    parser.add_argument('--launch-only', action='store_true', help='Nur Spiel starten, keine Installation')
    return parser.parse_args()

# Zufälliges Token generieren (nur als Fallback für Offline-Modus)
def generate_token():
    return str(random.randint(0, 1000000))  # Beispiel für zufälliges Token, hier eine Zufallszahl

# Hauptteil des Skripts
def main():
    args = parse_arguments()

    # Minecraft-Verzeichnis
    minecraft_directory = "./minecraft"


    print(minecraft_launcher_lib.fabric.get_latest_minecraft_version())

    if not args.launch_only:
        minecraft_launcher_lib.fabric.install_fabric("1.21.5", minecraft_directory)

    # Optionen für den Launcher
    options = {
        "username": args.name,
        "uuid": args.uuid,
        "token": args.token if args.token else generate_token(),  # Verwende echten Token oder Fallback
    }

    # Log token status for debugging
    if args.token:
        print(f"Using fresh Microsoft access token for online server support")
    else:
        print(f"No access token provided - using offline mode (cracked account)")

    # Minecraft-Startbefehl holen
    minecraft_command = minecraft_launcher_lib.command.get_minecraft_command("fabric-loader-0.16.14-1.21.5", minecraft_directory, options)
    print(" ".join(minecraft_command))  # Kommando ausgeben
    subprocess.run(minecraft_command)  # Minecraft starten

if __name__ == "__main__":
    main()