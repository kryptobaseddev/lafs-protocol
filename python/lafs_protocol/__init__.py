"""LAFS Protocol Python SDK

A complete implementation of the LLM-Agent-First Specification for Python.

This package provides tools for interacting with LAFS-compliant APIs,
including envelope validation, token budget enforcement, and discovery.
"""

from .envelope import Envelope, EnvelopeValidator, LAFSValidationError
from .budget import TokenEstimator, BudgetEnforcer, LAFSBudgetExceeded
from .client import LAFSClient, DiscoveryDocument, LAFSError, LAFSConnectionError

__version__ = "1.0.0"
__all__ = [
    "Envelope",
    "EnvelopeValidator",
    "LAFSValidationError",
    "TokenEstimator",
    "BudgetEnforcer",
    "LAFSBudgetExceeded",
    "LAFSClient",
    "DiscoveryDocument",
    "LAFSError",
    "LAFSConnectionError",
]
