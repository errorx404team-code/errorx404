from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseLanguageAdapter(ABC):
    @abstractmethod
    def parse_routine(self, raw_code: str) -> Dict[str, Any]:
        """Parse source code into structured tokens, functions, and global references."""
        pass

    @abstractmethod
    def extract_dependencies(self, raw_code: str) -> List[Dict[str, Any]]:
        """Extract dependency graph nodes and edges."""
        pass

    @abstractmethod
    def get_language_name(self) -> str:
        """Return language name."""
        pass
