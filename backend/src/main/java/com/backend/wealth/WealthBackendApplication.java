package com.backend.wealth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class WealthBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(WealthBackendApplication.class, args);
    }
}
