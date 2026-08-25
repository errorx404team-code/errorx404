VERIFY(DFN) ; Validate patient record
 N STATUS
 S STATUS=$G(^DPT(DFN,"STATUS"))
 I STATUS="ACTIVE" Q 1
 Q 0

CALC(W,D) ; Compute dosage
 I W<=0 Q 0
 I D<=0 Q 0
 Q W*D
