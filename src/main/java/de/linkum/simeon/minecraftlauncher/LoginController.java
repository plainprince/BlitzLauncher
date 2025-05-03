package de.linkum.simeon.minecraftlauncher;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import javafx.application.HostServices;
import javafx.application.Platform;
import javafx.event.ActionEvent;
import javafx.fxml.FXML;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.control.Alert.AlertType;

import javafx.scene.input.KeyCode;
import net.lenni0451.commons.httpclient.HttpClient;
import net.raphimc.minecraftauth.*;
import net.raphimc.minecraftauth.step.java.session.StepFullJavaSession;
import net.raphimc.minecraftauth.step.msa.StepMsaDeviceCode;

import java.io.IOException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ResourceBundle;
import java.util.UUID;

public class LoginController {
    public Label blitzClientText;
    @FXML private Label loginInstructionLabel;
    @FXML private Hyperlink loginLink;
    @FXML private Button loginButton;
    @FXML private Button startMinecraftButton;
    private String verificationUrl;
    private boolean crackedMode = false;
    MinecraftStarter MinecraftStarter = new MinecraftStarter();
    public String INSTALL_DIR = de.linkum.simeon.minecraftlauncher.MinecraftStarter.INSTALL_DIR;

    private HostServices hostServices;
    private Scene scene;
    private UUID mcid;
    private String name;

    public void setHostServices(HostServices hostServices) {
        this.hostServices = hostServices;
    }

    public void setScene(Scene scene) {
        this.scene = scene;
    }


    public void init() {
        Path accountsPath = Path.of(INSTALL_DIR).getParent().resolve("accounts.json");
        if (Files.exists(accountsPath)) {
            Platform.runLater(this::onLoginClicked); // ruft deine Login-Logik automatisch auf
        }
        startMinecraftButton.setPickOnBounds(true);
    }

    @FXML
    private void onLoginClicked() {
        // Fortschrittsanzeige oder Hinweis setzen
        loginInstructionLabel.setText("Starte Anmeldung...");

        // Authentifizierung in einem eigenen Thread, um UI nicht zu blockieren
        new Thread(() -> {
            try {
                Path accountsPath = Path.of(INSTALL_DIR).getParent().resolve("accounts.json");
                boolean accountsFileExists = Files.exists(accountsPath);

                loginButton.setVisible(false);
                HttpClient httpClient = MinecraftAuth.createHttpClient();

                StepFullJavaSession.FullJavaSession javaSession;

                if(!crackedMode && !accountsFileExists) {
                    javaSession = MinecraftAuth.JAVA_DEVICE_CODE_LOGIN.getFromInput(httpClient, new StepMsaDeviceCode.MsaDeviceCodeCallback(msaDeviceCode -> {
                        // Diese UI-Änderung muss wieder zurück in den JavaFX-Thread
                        verificationUrl = msaDeviceCode.getDirectVerificationUri();
                        Platform.runLater(() -> loginInstructionLabel.setText("Gehe zu: "));
                        Platform.runLater(() -> loginLink.setText(msaDeviceCode.getDirectVerificationUri()));
                    }));
                } else {
                    javaSession = null;
                }

                // Erfolgreich eingeloggt – im UI anzeigen
                Platform.runLater(() -> {
                    if(crackedMode) {
                        name = "dev";
                        mcid = UUID.randomUUID();
                    }else {
                        if (crackedMode) {
                            name = "dev";
                            mcid = UUID.randomUUID();
                        } else {
                            if (accountsFileExists) {
                                // accounts.json laden
                                String json = null;
                                try {
                                    json = Files.readString(accountsPath);
                                } catch (IOException e) {
                                    throw new RuntimeException(e);
                                }
                                JsonObject obj = JsonParser.parseString(json).getAsJsonObject();
                                name = obj.get("name").getAsString();
                                mcid = UUID.fromString(obj.get("uuid").getAsString());
                            } else {
                                // Vom Session-Login holen
                                name = javaSession.getMcProfile().getName();
                                mcid = javaSession.getMcProfile().getId();

                                // accounts.json schreiben
                                JsonObject newAccount = new JsonObject();
                                newAccount.addProperty("name", name);
                                newAccount.addProperty("uuid", mcid.toString());

                                Gson gson = new GsonBuilder().setPrettyPrinting().create();
                                try {
                                    Files.writeString(accountsPath, gson.toJson(newAccount), StandardOpenOption.CREATE_NEW);
                                } catch (IOException e) {
                                    throw new RuntimeException(e);
                                }
                            }
                        }
                    }

                    startMinecraftButton.setVisible(true);
                    blitzClientText.setVisible(true);

                    loginInstructionLabel.setText("");

                    showAlert(AlertType.INFORMATION, "Login Erfolgreich", "Willkommen, " + name + "!");

                    if (!Files.exists(accountsPath)) {
                        try {
                            JsonObject account = new JsonObject();
                            account.addProperty("name", name);
                            account.addProperty("uuid", mcid.toString());

                            Gson gson = new GsonBuilder().setPrettyPrinting().create();
                            String jsonContent = gson.toJson(account);

                            Files.writeString(accountsPath, jsonContent, StandardOpenOption.CREATE_NEW);
                            System.out.println("accounts.json wurde erstellt.");
                        } catch (IOException e) {
                            System.err.println("Fehler beim Schreiben von accounts.json: " + e.getMessage());
                            e.printStackTrace();
                        }
                    } else {
                        System.out.println("accounts.json existiert bereits.");
                    }
                });

            } catch (Exception e) {
                e.printStackTrace();

                // Fehlerbehandlung im UI
                Platform.runLater(() -> {
                    String errorMsg = e.toString().contains("404") ?
                            "Minecraft-Account nicht gefunden – bitte überprüfen, ob das Spiel gekauft wurde." :
                            "Fehler beim Anmelden mit Microsoft. Bitte versuchen Sie eine andere Methode.";
                    showAlert(AlertType.ERROR, "Login Fehler", errorMsg);
                    loginButton.setVisible(true);
                    loginInstructionLabel.setText("");
                    loginLink.setText("");
                });
            }
        }).start();
    }

    // Hilfsmethode zur Anzeige von Alert-Nachrichten
    private void showAlert(AlertType type, String title, String message) {
        Alert alert = new Alert(type);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.showAndWait();
    }

    public void onLoginLinkClicked(ActionEvent actionEvent) {
        if (verificationUrl != null && !verificationUrl.isEmpty()) {
            hostServices.showDocument(verificationUrl);
        }
    }

    public void crackedModeActivated() {
        scene.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.F7) {
                crackedMode = true;
            }
        });
    }

    public void startMinecraft(UUID mcid, String name) throws IOException, InterruptedException {
        // Path to the BlitzClient folder in APPDATA
        String appDataPath = de.linkum.simeon.minecraftlauncher.MinecraftStarter.INSTALL_DIR;
        Path blitzClientFolder = Paths.get(appDataPath);

        startMinecraftButton.setDisable(true);

        if (Files.exists(blitzClientFolder)) {
            // Folder exists, just run the executable
            System.out.println("BlitzClient folder exists. Running the executable...");
            MinecraftStarter.run(mcid, name, startMinecraftButton);
        } else {
            // Folder does not exist, download and then run
            System.out.println("BlitzClient folder does not exist. Downloading and extracting files...");
            download(MinecraftStarter);

            // Start Minecraft in einem separaten Thread
            Thread minecraftThread = new Thread(() -> {
                MinecraftStarter.run(mcid, name, startMinecraftButton);
            });
            minecraftThread.start();

            // Warten, damit Minecraft startet
            // Hier kannst du eine kleine Verzögerung einbauen, falls notwendig
            Thread.sleep(10);

            // Start Mods-Download in einem separaten Thread
            Thread modsDownloadThread = new Thread(() -> {
                try {
                    MinecraftStarter.downloadMods();
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            });
            modsDownloadThread.start();
        }
    }

    private void download(MinecraftStarter minecraftStarter) throws IOException, InterruptedException {
        // Call the existing download method to download and unzip the files

        minecraftStarter.download();
    }

    public void onMinecraftLaunch(ActionEvent ignoredActionEvent) throws IOException, InterruptedException {
        startMinecraft(mcid, name);
    }
}