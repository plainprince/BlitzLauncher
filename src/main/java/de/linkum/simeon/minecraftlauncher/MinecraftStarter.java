package de.linkum.simeon.minecraftlauncher;

import java.io.*;
import java.net.URL;
import java.nio.file.*;
import java.util.*;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipFile;


public class MinecraftStarter {

    public static final String DOWNLOAD_URL = "https://blitzclient.netlify.app/clientdata/%s-%s.zip";
    public static final String INSTALL_DIR = getAppDataDirectory() + File.separator + "BlitzClient" + File.separator + "client-installer";

    public MinecraftStarter() {
    }

    public void download() throws IOException {
        String os = System.getProperty("os.name").toLowerCase();
        String arch = System.getProperty("os.arch").toLowerCase();

        // Determine the platform (windows, macos, linux)
        String platform = switch (os) {
            case String s when s.contains("win") -> "windows";
            case String s when s.contains("mac") -> "macos";
            case String s when s.contains("nix") || s.contains("nux") -> "linux";
            default -> throw new RuntimeException("Unsupported OS: " + os);
        };

        // Determine the architecture (x64, arm64)
        String architecture = switch (arch) {
            case "amd64", "x86_64" -> "x64";
            case "aarch64" -> "arm64";
            default -> throw new RuntimeException("Unsupported architecture: " + arch);
        };

        // Build the download URL based on platform and architecture
        String downloadUrl = String.format(DOWNLOAD_URL, platform, architecture);
        Path downloadDir = Paths.get(INSTALL_DIR);

        // Create the installation directory if it does not exist
        if (!Files.exists(downloadDir)) {
            Files.createDirectories(downloadDir);
        }

        // Download the zip file
        Path zipFile = downloadZip(downloadUrl, downloadDir);

        // Extract the zip file
        unzipFile(zipFile, downloadDir);
    }

    public void run(UUID mcid, String name) throws IOException, InterruptedException {
        new Thread(() -> {
            try {
                String platform = getPlatform();
                Path installDir = Paths.get(INSTALL_DIR);
                Path parentDir = installDir.getParent(); // ⬅️ wichtig

                String executablePath = installDir.resolve("test").toString();

                ProcessBuilder pb = new ProcessBuilder(
                        executablePath,
                        "--uuid", mcid.toString(),
                        "--name", name
                );

                pb.directory(parentDir.toFile()); // ⬅️ Arbeitsverzeichnis setzen
                pb.inheritIO();

                Process process = pb.start();
                process.waitFor();
            } catch (Exception e) {
                System.err.println("Error while running executable: " + e.getMessage());
                e.printStackTrace();
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

    private String getPlatform() {
        String os = System.getProperty("os.name").toLowerCase();
        return switch (os) {
            case String s when s.contains("win") -> "windows";
            case String s when s.contains("mac") -> "macos";
            case String s when s.contains("nix") || s.contains("nux") -> "linux";
            default -> throw new RuntimeException("Unsupported OS: " + os);
        };
    }

    private Path downloadZip(String downloadUrl, Path targetDir) throws IOException {
        URL url = new URL(downloadUrl);
        Path zipFile = targetDir.resolve("clientdata.zip");
        try (InputStream in = url.openStream()) {
            Files.copy(in, zipFile, StandardCopyOption.REPLACE_EXISTING);
        }
        return zipFile;
    }

    public void unzipFile(Path zipFile, Path targetDir) throws IOException {
        try (ZipFile zip = new ZipFile(zipFile.toFile())) {
            Enumeration<ZipArchiveEntry> entries = zip.getEntries();
            while (entries.hasMoreElements()) {
                ZipArchiveEntry entry = entries.nextElement();
                Path outPath = targetDir.resolve(entry.getName());

                if (entry.isDirectory()) {
                    Files.createDirectories(outPath);
                } else {
                    Files.createDirectories(outPath.getParent());
                    try (InputStream in = zip.getInputStream(entry);
                         OutputStream out = Files.newOutputStream(outPath)) {
                        in.transferTo(out);
                    }
                }
            }
        }
    }

    private String findExecutable(Path installDir, String platform) throws IOException {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(installDir)) {
            for (Path entry : stream) {
                String name = entry.getFileName().toString();
                if (Files.isExecutable(entry) && !name.equals("__MACOSX") && !Files.isDirectory(entry)) {
                    return entry.toAbsolutePath().toString();
                }
            }
        }

        throw new FileNotFoundException("Executable not found in " + installDir);
    }
}