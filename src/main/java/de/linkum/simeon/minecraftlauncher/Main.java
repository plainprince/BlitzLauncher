package de.linkum.simeon.minecraftlauncher;

import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.scene.text.Font;
import javafx.stage.Screen;
import javafx.stage.Stage;

import java.io.IOException;
import java.util.Objects;

public class Main extends Application {
    @Override
    public void start(Stage stage) throws Exception {
        double screenWidth = Screen.getPrimary().getVisualBounds().getWidth();
        double screenHeight = Screen.getPrimary().getVisualBounds().getHeight();
        FXMLLoader loader = new FXMLLoader(getClass().getResource("login-view.fxml"));
        Scene scene = new Scene(loader.load(), screenWidth, screenHeight);
        scene.getStylesheets().add(Objects.requireNonNull(getClass().getResource("styles.css")).toExternalForm());

        LoginController controller = loader.getController();
        controller.setHostServices(getHostServices());
        controller.setScene(scene);
        controller.crackedModeActivated();
        controller.init();

        Font.loadFont(
                getClass().getResourceAsStream("/de/linkum/simeon/minecraftlauncher/fonts/Tagesschrift.ttf"),
                20
        );

        stage.setScene(scene);
        stage.setTitle("BlitzLauncher");
        stage.show();
    }

    public static void main(String[] args) throws IOException {
        launch(args);
    }
}