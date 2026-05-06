package com.coffeecompass.service;

import com.coffeecompass.dto.AuthRequest;
import com.coffeecompass.dto.AuthResponse;
import com.coffeecompass.model.User;
import com.coffeecompass.repository.UserRepository;
import com.coffeecompass.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        String hash = passwordEncoder.encode(request.getPassword());
        User user = userRepository.save(new User(request.getUsername(), hash));
        return buildResponse(user);
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return buildResponse(user);
    }

    private AuthResponse buildResponse(User user) {
        String token = jwtUtil.generateToken(user.getId(), user.getUsername());
        long expiresAt = System.currentTimeMillis() + jwtUtil.getExpirationMs();
        return new AuthResponse(token, user.getUsername(), expiresAt);
    }
}
