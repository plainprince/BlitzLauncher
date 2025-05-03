package de.linkum.simeon.minecraftlauncher;

import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.Button;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;


public class MinecraftStarter {

    public static final String INSTALL_DIR = getAppDataDirectory() + File.separator + "BlitzClient" + File.separator + "client-installer";

    public MinecraftStarter() {
    }

    public void download() throws IOException, InterruptedException {
        String os = System.getProperty("os.name").toLowerCase();
        String arch = System.getProperty("os.arch").toLowerCase();

        String platform = switch (os) {
            case String s when s.contains("win") -> "windows";
            case String s when s.contains("mac") -> "macos";
            case String s when s.contains("nix") -> "linux";
            case String s when s.contains("nux") -> "linux";
            case String s when s.contains("aix") -> "linux";
                default -> throw new RuntimeException("Unsupported OS: " + os);
        };

        String architecture = switch (arch) {
            case "amd64", "x86_64" -> "x64";
            case "aarch64" -> "arm64";
            default -> throw new RuntimeException("Unsupported architecture: " + arch);
        };

        String fileName = platform + "-" + architecture + ".zip";
        String urlStr = "https://nightly.link/plainprince/BlitzLauncher/workflows/pythonbuild/main/" + fileName;

        Path zipPath = Path.of(INSTALL_DIR, fileName);
        Files.createDirectories(Path.of(INSTALL_DIR));

        HttpURLConnection connection = (HttpURLConnection) new URL(urlStr).openConnection();
        connection.setInstanceFollowRedirects(true); // sehr wichtig
        connection.setRequestProperty("User-Agent", "Java downloader"); // manche Server blocken sonst

        int responseCode = connection.getResponseCode();
        String contentType = connection.getContentType();

        if (responseCode != 200 || !contentType.contains("zip")) {
            throw new IOException("Fehler beim Herunterladen: HTTP " + responseCode + ", Content-Type: " + contentType);
        }

        try (InputStream in = connection.getInputStream()) {
            Files.copy(in, zipPath, StandardCopyOption.REPLACE_EXISTING);
        }

        if (Files.size(zipPath) < 100) {
            throw new IOException("Heruntergeladene Datei ist zu klein – vermutlich kein gültiges ZIP.");
        }

        unzip(zipPath, Path.of(INSTALL_DIR));
        File f = new File(INSTALL_DIR + "/os");
        f.setExecutable(true);
    }

    public void downloadMods() throws IOException {
        String sodiumUrl = "https://cdn.modrinth.com/data/AANobbMI/versions/DA250htH/sodium-fabric-0.6.13%2Bmc1.21.5.jar";
        Path modsDir = Path.of(INSTALL_DIR).getParent().resolve("minecraft/mods");
        Files.createDirectories(modsDir);

        HttpURLConnection sodiumConn = (HttpURLConnection) new URL(sodiumUrl).openConnection();
        sodiumConn.setInstanceFollowRedirects(true);
        sodiumConn.setRequestProperty("User-Agent", "Java downloader");

        int sodiumResponse = sodiumConn.getResponseCode();
        if (sodiumResponse != 200) {
            throw new IOException("Sodium-Download fehlgeschlagen: HTTP " + sodiumResponse);
        }

        Path sodiumJarPath = modsDir.resolve("sodium-fabric-0.6.13+mc1.21.5.jar");

        try (InputStream in = sodiumConn.getInputStream()) {
            Files.copy(in, sodiumJarPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private void unzip(Path zipFile, Path targetDir) throws IOException {
        try (ZipFile zip = new ZipFile(zipFile.toFile())) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                Path entryPath = targetDir.resolve(entry.getName());

                if (entry.isDirectory()) {
                    Files.createDirectories(entryPath);
                } else {
                    Files.createDirectories(entryPath.getParent());
                    try (InputStream in = zip.getInputStream(entry);
                         OutputStream out = Files.newOutputStream(entryPath)) {
                        in.transferTo(out);
                    }
                }
            }
        }
    }

    public void run(UUID mcid, String name, Button startMinecraftButton) {
        new Thread(() -> {
            try {
                Path installDir = Paths.get(INSTALL_DIR);
                Path parentDir = installDir.getParent(); // ⬅️ wichtig
                Path minecraftDir = parentDir.resolve("minecraft"); // Pfad zum minecraft Verzeichnis

                String executablePath = installDir.resolve("os").toString();

                // Basis-Argumente
                List<String> args = new ArrayList<>();
                args.add(executablePath);
                args.add("--uuid");
                args.add(mcid != null ? mcid.toString() : "0000");
                args.add("--name");
                args.add(name != null ? name : "Whyareyoureadingthis");

                // Falls parentDir/minecraft existiert → --launch-only anhängen
                if (Files.exists(minecraftDir)) {
                    args.add("--launch-only");
                }

                ProcessBuilder pb = new ProcessBuilder(args);
                pb.directory(parentDir != null ? parentDir.toFile() : null); // Arbeitsverzeichnis setzen
                pb.inheritIO();

                Process process = pb.start();
                process.waitFor();
            } catch (Exception e) {
                System.err.println("Error while running executable: " + e.getMessage());
                e.printStackTrace();
            } finally {
                Platform.runLater(() -> startMinecraftButton.setDisable(false));
            }
        }, "MinecraftLauncher-ExecThread").start();
    }

    private static String getAppDataDirectory() {
        String os = System.getProperty("os.name").toLowerCase();
        String userHome = System.getProperty("user.home");

        return switch (os) {
            case String s when s.contains("win") -> System.getenv("APPDATA");
            case String s when s.contains("mac") -> userHome + "/Library/Application Support";
            case String s when s.contains("nix") || s.contains("nux") -> userHome + "/.local/share";
            default -> throw new RuntimeException("Unsupported OS for app data directory");
        };
    }
}