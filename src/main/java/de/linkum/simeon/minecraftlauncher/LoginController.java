package de.linkum.simeon.minecraftlauncher;

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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

public class LoginController {
    @FXML private Label loginInstructionLabel;
    @FXML private Hyperlink loginLink;
    @FXML private Button loginButton;
    @FXML private Button startMinecraftButton;
    private String verificationUrl;
    private boolean crackedMode = false;

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

    @FXML
    private void onLoginClicked() {
        // Fortschrittsanzeige oder Hinweis setzen
        loginInstructionLabel.setText("Starte Anmeldung...");

        // Authentifizierung in einem eigenen Thread, um UI nicht zu blockieren
        new Thread(() -> {
            try {
                loginButton.setVisible(false);
                HttpClient httpClient = MinecraftAuth.createHttpClient();

                StepFullJavaSession.FullJavaSession javaSession;

                if(!crackedMode) {
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
                        name = javaSession.getMcProfile().getName();
                        mcid = javaSession.getMcProfile().getId();
                    }

                    startMinecraftButton.setVisible(true);

                    loginInstructionLabel.setText("Erfolgreich eingeloggt als: " + name + "\nMit UUID: " + mcid.toString());

                    showAlert(AlertType.INFORMATION, "Login Erfolgreich", "Willkommen, " + name + "!");
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
        MinecraftStarter MinecraftStarter = new MinecraftStarter();
        // Path to the BlitzClient folder in APPDATA
        String appDataPath = de.linkum.simeon.minecraftlauncher.MinecraftStarter.INSTALL_DIR;
        Path blitzClientFolder = Paths.get(appDataPath).getParent();

        if (Files.exists(blitzClientFolder)) {
            // Folder exists, just run the executable
            System.out.println("BlitzClient folder exists. Running the executable...");
            MinecraftStarter.run(mcid, name);
        } else {
            // Folder does not exist, download and then run
            System.out.println("BlitzClient folder does not exist. Downloading and extracting files...");
            download(MinecraftStarter);
            MinecraftStarter.run(mcid, name);
        }
    }

    private void download(MinecraftStarter minecraftStarter) throws IOException {
        // Call the existing download method to download and unzip the files

        minecraftStarter.download();
    }

    public void onMinecraftLaunch(ActionEvent ignoredActionEvent) throws IOException, InterruptedException {
        startMinecraft(mcid, name);
    }
}