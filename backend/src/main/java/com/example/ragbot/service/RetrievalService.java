package com.example.ragbot.service;

import com.example.ragbot.config.MilvusProperties;
import com.example.ragbot.model.RetrievedChunk;
import io.milvus.client.MilvusServiceClient;
import io.milvus.grpc.SearchResults;
import io.milvus.param.ConnectParam;
import io.milvus.param.MetricType;
import io.milvus.param.R;
import io.milvus.param.dml.SearchParam;
import io.milvus.response.SearchResultsWrapper;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
public class RetrievalService {

    private final MilvusProperties properties;
    private final MilvusServiceClient milvus;

    public RetrievalService(MilvusProperties properties) {
        this.properties = properties;
        this.milvus = new MilvusServiceClient(
                ConnectParam.newBuilder()
                        .withHost(properties.host())
                        .withPort(properties.port())
                        .build()
        );
    }

    public List<RetrievedChunk> searchTopK(List<Float> queryVector, int topK) {
        SearchParam params = SearchParam.newBuilder()
                .withCollectionName(properties.collection())
                .withMetricType(MetricType.COSINE)
                .withTopK(topK)
                .withFloatVectors(List.of(queryVector))
                .withVectorFieldName("embedding")
                .withParams("{\"ef\":64}")
                .withOutFields(List.of("chunk_text", "source_url", "source_type", "page", "chunk_index", "doc_title"))
                .build();

        R<SearchResults> response = milvus.search(params);
        if (response.getStatus() != R.Status.Success.getCode()) {
            String msg = response.getMessage();
            if (msg != null && (msg.contains("collection is empty") || msg.contains("Illegal field name"))) {
                return List.of();
            }
            throw new IllegalStateException("Milvus search failed: " + msg);
        }
        if (response.getData() == null) {
            return List.of();
        }

        SearchResultsWrapper wrapper = new SearchResultsWrapper(response.getData().getResults());
        List<SearchResultsWrapper.IDScore> scores = wrapper.getIDScore(0);
        List<String> texts = field(wrapper, "chunk_text");
        List<String> sourceUrls = field(wrapper, "source_url");
        List<String> sourceTypes = field(wrapper, "source_type");
        List<Integer> pages = field(wrapper, "page");
        List<Integer> chunkIndexes = field(wrapper, "chunk_index");
        List<String> docTitles = field(wrapper, "doc_title");

        List<RetrievedChunk> chunks = new java.util.ArrayList<>();
        for (int i = 0; i < scores.size(); i++) {
            SearchResultsWrapper.IDScore score = scores.get(i);
            chunks.add(new RetrievedChunk(
                    score.getLongID(),
                    valueAt(texts, i, ""),
                    valueAt(sourceUrls, i, ""),
                    valueAt(sourceTypes, i, ""),
                    valueAt(pages, i, 0),
                    valueAt(chunkIndexes, i, 0),
                    valueAt(docTitles, i, "Untitled"),
                    (double) score.getScore()
            ));
        }
        return chunks;
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> field(SearchResultsWrapper wrapper, String fieldName) {
        Object data = wrapper.getFieldData(fieldName, 0);
        if (data instanceof List<?> list) {
            return (List<T>) list;
        }
        return Collections.emptyList();
    }

    private <T> T valueAt(List<T> values, int index, T fallback) {
        if (index < 0 || index >= values.size()) {
            return fallback;
        }
        T value = values.get(index);
        return value == null ? fallback : value;
    }

    @PreDestroy
    public void close() {
        milvus.close();
    }
}
