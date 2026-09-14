package com.example.ragbot.service;

import com.example.ragbot.model.RetrievedChunk;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class CandidateRerankerTest {
    CandidateReranker reranker = new CandidateReranker();
    RetrievedChunk chunk(long id, String text, double score) { return new RetrievedChunk(id, text, "", "text", 0, 0, "FPT", score); }
    @Test void specificRevenueEvidenceOutranksGenericAnnualReportWithoutChangingScore() {
        var generic = chunk(1L, "Báo cáo thường niên FPT 2024. Tình hình hoạt động.", .819);
        var revenue = chunk(2L, "Lịch sử doanh thu FPT qua các năm. Năm 2024 đạt 62.849 tỷ đồng.", .778);
        var ranked = reranker.rank("Doanh thu của FPT năm 2024 là bao nhiêu?", List.of(generic, revenue), 1);
        assertThat(ranked).containsExactly(revenue);
        assertThat(ranked.get(0).score()).isEqualTo(.778);
    }
    @Test void adjacentTermsOutrankScatteredKeywordsInPdfText() {
        var noisy = chunk(1L, "FPT 2024. Báo cáo kinh doanh. Các khoản thu từ hoạt động.", .819);
        var faq = chunk(2L, "Doanh thu FPT 2024 đạt 62.849 tỷ đồng.", .778);
        assertThat(reranker.rank("Doanh thu của FPT năm 2024 là bao nhiêu?", List.of(noisy, faq), 1))
                .containsExactly(faq);
    }
    @Test void accentsAndCaseAreNormalized() {
        var match = chunk(1L, "Chính sách môi trường", .7);
        var other = chunk(2L, "Khác", .75);
        assertThat(reranker.rank("CHINH SACH MOI TRUONG", List.of(other, match), 2)).containsExactly(match, other);
    }
    @Test void emptyQueryKeepsSemanticOrderAndRespectsLimit() {
        var high = chunk(1L, "A", .9);
        var low = chunk(2L, "B", .6);
        assertThat(reranker.rank("", List.of(low, high), 1)).containsExactly(high);
    }
}
