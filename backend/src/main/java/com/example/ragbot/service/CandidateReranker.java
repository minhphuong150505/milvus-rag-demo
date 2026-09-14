package com.example.ragbot.service;

import com.example.ragbot.model.RetrievedChunk;
import org.springframework.stereotype.Component;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.IntStream;

/** Lexical reranking inside a bounded semantic pool. Source scores remain the original cosine values. */
@Component
public class CandidateReranker {
    private static final Set<String> STOP_WORDS = Set.of(
            "cua", "la", "va", "co", "nhung", "nao", "gi", "bao", "nhieu", "ve", "cho", "toi",
            "trong", "voi", "duoc", "cac", "hay", "den", "nhu", "the", "nam", "gom", "mot", "con", "vay"
    );

    public List<RetrievedChunk> rank(String question, List<RetrievedChunk> candidates, int topK) {
        List<String> queryTokens = tokens(question);
        Set<String> query = new HashSet<>(queryTokens);
        Set<String> queryPairs = pairs(queryTokens);
        return candidates.stream().sorted(Comparator.comparingDouble((RetrievedChunk chunk) -> {
            List<String> words = tokens(chunk.text());
            // Adjacent terms distinguish "doanh thu" from isolated words in noisy PDF columns.
            return chunk.score() + 0.2 * coverage(query, new HashSet<>(words))
                    + 0.2 * coverage(queryPairs, pairs(words));
        }).reversed()).limit(topK).toList();
    }

    private double coverage(Set<String> query, Set<String> document) {
        return query.isEmpty() ? 0 : (double) query.stream().filter(document::contains).count() / query.size();
    }

    private Set<String> pairs(List<String> words) {
        Set<String> pairs = new HashSet<>();
        IntStream.range(0, words.size() - 1).forEach(i -> pairs.add(words.get(i) + " " + words.get(i + 1)));
        return pairs;
    }

    private List<String> tokens(String text) {
        String normalized = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replace('đ', 'd');
        return Arrays.stream(normalized.split("[^a-z0-9]+"))
                .filter(word -> !word.isEmpty() && !STOP_WORDS.contains(word)).toList();
    }
}
